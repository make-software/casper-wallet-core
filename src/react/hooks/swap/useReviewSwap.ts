import { useCallback, useEffect, useState } from 'react';

import { useSwapStates } from './useSwapStates';
import { useSwapTransaction, type IUseSwapTransactionParams } from './useSwapTransaction';

import { useTokenApprovalFlow } from '../token/useTokenApprovalFlow';

import { CSPR_NATIVE_TOKEN_ID } from '../../../domain/constants';
import type { IDexTokenWithAmount, SwapQuoteType } from '../../../domain/swap';
import { calculateApprovalAmount, calculateMaxAmountWithSlippage } from '../../../utils/amounts';
import { getTransactionErrorMessage } from '../../../utils/swap';
import type {
  ApprovalState,
  ISwapDependencies,
  ITransactionCallbacks,
  TransactionStatus,
} from '../../types';

type SwapStep = 'confirm' | 'signing' | 'success';

export interface IUseReviewSwapParams extends Pick<
  ISwapDependencies,
  'network' | 'activePublicKey' | 'dexContractRepository' | 'signer'
> {
  /** Max slippage in percent — the same value passed to the swap build. */
  slippage: number;
  /** Transaction deadline in minutes. */
  deadline: number;
  firstToken: IDexTokenWithAmount;
  secondToken: IDexTokenWithAmount;
  path: string[];
  quoteType: SwapQuoteType;
  isOpen: boolean;
  onSwapSuccess: () => void;
  onClose: () => void;
}

export interface ISwapTransactionState {
  approval: ApprovalState;
  swap: { status: TransactionStatus; error?: string };
}

/**
 * Approval-then-swap orchestration for the review modal. `checkApprovalRequired` drives the
 * UI's "checking" state; `checkAndApprove` then performs the real check and execution.
 */
export const useReviewSwap = ({
  network,
  activePublicKey,
  dexContractRepository,
  signer,
  slippage,
  deadline,
  firstToken,
  secondToken,
  path,
  quoteType,
  isOpen,
  onSwapSuccess,
  onClose,
}: IUseReviewSwapParams) => {
  const [step, setStep] = useState<SwapStep>('confirm');
  // Scoped to the leg that produced it: a swap that fails after a successful approval must not
  // mark the approval step as failed.
  const [errors, setErrors] = useState<{ approval?: string; swap?: string }>({});
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [approvalHash, setApprovalHash] = useState<string | undefined>(undefined);

  const { swapTokens } = useSwapTransaction({
    network,
    dexContractRepository,
    signer,
    slippage,
    deadline,
  });
  const { checkApprovalRequired, checkAndApprove } = useTokenApprovalFlow({
    network,
    activePublicKey,
    dexContractRepository,
    signer,
  });
  const {
    transactionStates,
    approvalRequirements,
    setApprovalRequirements,
    updateTransactionState,
    resetStates,
  } = useSwapStates();

  const resetForm = useCallback(() => {
    setStep('confirm');
    setErrors({});
    setTransactionHash(null);
    setApprovalHash(undefined);
    resetStates();
  }, [resetStates]);

  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);

  const processSwapTokens = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!activePublicKey) {
        reject(new Error('No active account'));
        return;
      }

      updateTransactionState('swap', 'pending');

      const callbacks: ITransactionCallbacks = {
        onSent: hash => {
          setTransactionHash(hash);
          updateTransactionState('swap', 'awaiting');
        },
        onProcessed: () => {
          updateTransactionState('swap', 'success');
          setStep('success');
          resolve();
        },
        onError: swapError => {
          updateTransactionState('swap', 'error');
          reject(swapError);
        },
        onCancelled: () => {
          updateTransactionState('swap', 'idle');
          reject(new Error('Swap transaction cancelled'));
        },
      };

      const params: IUseSwapTransactionParams = {
        firstToken,
        secondToken,
        path,
        quoteType,
        publicKey: activePublicKey,
      };

      swapTokens(params, callbacks).catch(swapError => {
        updateTransactionState('swap', 'error');
        reject(swapError);
      });
    });
  }, [
    activePublicKey,
    firstToken,
    path,
    quoteType,
    secondToken,
    swapTokens,
    updateTransactionState,
  ]);

  // Main confirmation flow: check+execute approval for the first token (CSPR never needs
  // approval), then run the swap.
  const confirmSwap = useCallback(async () => {
    if (!activePublicKey) return;

    setStep('signing');
    setErrors({});

    let leg: 'approval' | 'swap' = 'approval';

    try {
      const isFirstTokenNative = firstToken.id === CSPR_NATIVE_TOKEN_ID;
      const firstTokenAmountRaw = firstToken.amountRaw;

      const requiredAmount = isFirstTokenNative
        ? firstTokenAmountRaw
        : calculateMaxAmountWithSlippage(firstTokenAmountRaw, slippage);

      // The grant is derived from the same amount the check is made against, so the approval
      // always clears `checkApprovalRequired` — a grant derived from any other basis can fail
      // the check it was made for and leave the flow re-prompting for an approval fee forever.
      const approvalAmount = isFirstTokenNative
        ? firstTokenAmountRaw // CSPR doesn't need approval, but keep for consistency
        : calculateApprovalAmount(requiredAmount);

      const firstCheckConfig = {
        contractPackageHash: firstToken.packageHash,
        requiredAmount,
      };
      const firstExecuteConfig = {
        contractPackageHash: firstToken.packageHash,
        approvalAmount,
      };

      setApprovalRequirements(prev => ({ ...prev, isChecking: true }));

      const approvalRequired = await checkApprovalRequired(firstCheckConfig);

      setApprovalRequirements({ firstRequired: approvalRequired, isChecking: false });
      updateTransactionState('approval', approvalRequired ? 'pending' : 'success');

      await checkAndApprove(firstCheckConfig, firstExecuteConfig, {
        onSent: hash => {
          setApprovalHash(hash);
        },
        onProcessed: () => {
          updateTransactionState('approval', 'success');
        },
        onError: () => {
          updateTransactionState('approval', 'error');
        },
        onCancelled: () => {
          updateTransactionState('approval', 'error');
        },
      });

      leg = 'swap';
      await processSwapTokens();
    } catch (txError) {
      setErrors({ [leg]: getTransactionErrorMessage(txError) });
      // A throw out of the check itself would otherwise leave `isChecking` true forever.
      setApprovalRequirements(prev => ({ ...prev, isChecking: false }));
      // Back to 'confirm' so the modal is retryable in place — `isProcessing` is derived from
      // the step, and leaving it on 'signing' strands the modal with no path but closing it.
      setStep('confirm');
    }
  }, [
    activePublicKey,
    checkAndApprove,
    checkApprovalRequired,
    firstToken.amountRaw,
    firstToken.id,
    firstToken.packageHash,
    processSwapTokens,
    setApprovalRequirements,
    slippage,
    updateTransactionState,
  ]);

  const computedTransactionState: ISwapTransactionState = {
    approval: {
      isRequired: approvalRequirements.firstRequired,
      status: approvalRequirements.isChecking
        ? 'pending'
        : approvalRequirements.firstRequired
          ? transactionStates.approval
          : 'success',
      transactionHash: approvalHash,
      error: errors.approval,
    },
    swap: {
      status: transactionStates.swap,
      error: errors.swap,
    },
  };

  const handleCloseSuccessModal = useCallback(() => {
    onSwapSuccess();
    onClose();
  }, [onClose, onSwapSuccess]);

  return {
    step,
    transactionState: computedTransactionState,
    isProcessing: step === 'signing' && transactionStates.swap !== 'success',
    confirmSwap,
    resetForm,
    handleCloseSuccessModal,
    transactionHash,
  };
};
