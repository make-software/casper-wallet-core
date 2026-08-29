import { useCallback, useEffect, useState } from 'react';

import { useSwapStates } from './useSwapStates';
import { useSwapTransaction, type IUseSwapTransactionParams } from './useSwapTransaction';

import { useContractSettings } from '../context/useContractSettings';
import { useRepositories } from '../context/useRepositories';
import { useTokenApprovalFlow } from '../token/useTokenApprovalFlow';

import { CSPR_NATIVE_TOKEN_ID } from '../../../domain/constants';
import type { IDexTokenWithAmount, SwapQuoteType } from '../../../domain/swap';
import { calculateApprovalAmount, calculateMaxAmountWithSlippage } from '../../../utils/amounts';
import type { ApprovalState, ITransactionCallbacks, TransactionStatus } from '../../types';

type SwapStep = 'confirm' | 'signing' | 'success';

export interface IUseReviewSwapParams {
  firstToken: IDexTokenWithAmount;
  secondToken: IDexTokenWithAmount;
  firstRawTokenBalance?: string;
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
  firstToken,
  secondToken,
  firstRawTokenBalance = '0',
  path,
  quoteType,
  isOpen,
  onSwapSuccess,
  onClose,
}: IUseReviewSwapParams) => {
  const [step, setStep] = useState<SwapStep>('confirm');
  const [error, setError] = useState<string | null>(null);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);

  const { activePublicKey } = useRepositories();
  const { swapTokens } = useSwapTransaction();
  const { checkApprovalRequired, checkAndApprove } = useTokenApprovalFlow();
  const {
    transactionStates,
    approvalRequirements,
    setApprovalRequirements,
    updateTransactionState,
    resetStates,
  } = useSwapStates();
  const { slippage } = useContractSettings();

  const resetForm = useCallback(() => {
    setStep('confirm');
    setError(null);
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
    setError(null);

    try {
      const isFirstTokenNative = firstToken.id === CSPR_NATIVE_TOKEN_ID;
      const firstTokenAmountRaw = firstToken.amountRaw;

      const requiredAmount = isFirstTokenNative
        ? firstTokenAmountRaw
        : calculateMaxAmountWithSlippage(firstTokenAmountRaw, slippage);

      // For approval execution, use full balance + buffer strategy.
      const approvalAmount = isFirstTokenNative
        ? firstTokenAmountRaw // CSPR doesn't need approval, but keep for consistency
        : calculateApprovalAmount(firstRawTokenBalance);

      const firstCheckConfig = {
        contractPackageHash: firstToken.packageHash,
        requiredAmount,
      };
      const firstExecuteConfig = {
        contractPackageHash: firstToken.packageHash,
        balance: approvalAmount,
      };

      setApprovalRequirements(prev => ({ ...prev, isChecking: true }));

      const approvalRequired = await checkApprovalRequired(firstCheckConfig);

      setApprovalRequirements({ firstRequired: approvalRequired, isChecking: false });
      updateTransactionState('approval', approvalRequired ? 'pending' : 'success');

      await checkAndApprove(firstCheckConfig, firstExecuteConfig, {
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

      await processSwapTokens();
    } catch {
      setError('Transaction failed');
    }
  }, [
    activePublicKey,
    checkAndApprove,
    checkApprovalRequired,
    firstRawTokenBalance,
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
      error: error ?? undefined,
    },
    swap: {
      status: transactionStates.swap,
      error: error ?? undefined,
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
