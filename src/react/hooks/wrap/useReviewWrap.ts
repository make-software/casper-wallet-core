import { useCallback, useEffect, useState } from 'react';

import { useWrapTransaction, type IUseWrapTransactionParams } from './useWrapTransaction';

import { useRepositories } from '../context/useRepositories';
import { useTransactionStatuses } from '../ui/useTransactionStatuses';

import type { WrapDirection } from '../../../domain/dex';
import type { IDexTokenWithAmount } from '../../../domain/swap';
import { getTransactionErrorMessage } from '../../../utils/swap';
import type { ITransactionCallbacks } from '../../types';

type WrapStep = 'confirm' | 'signing' | 'success';

const WRAP_STATUS_KEYS = ['wrap'] as const;

export interface IUseReviewWrapParams {
  direction: WrapDirection;
  sourceToken: IDexTokenWithAmount;
  isOpen: boolean;
  onWrapSuccess: () => void;
  onClose: () => void;
}

/**
 * Review-modal flow for wrap/unwrap. A single build+sign step, unlike `useReviewSwap`: wrap has
 * no slippage/deadline and needs no approval (`withdraw` burns the caller's own balance).
 */
export const useReviewWrap = ({
  direction,
  sourceToken,
  isOpen,
  onWrapSuccess,
  onClose,
}: IUseReviewWrapParams) => {
  const { activePublicKey } = useRepositories();
  const { execute } = useWrapTransaction();
  const { transactionStates, updateTransactionState, resetStates } =
    useTransactionStatuses(WRAP_STATUS_KEYS);

  const [step, setStep] = useState<WrapStep>('confirm');
  const [error, setError] = useState<string | null>(null);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);

  const status = transactionStates.wrap;

  const resetForm = useCallback(() => {
    setStep('confirm');
    resetStates();
    setError(null);
    setTransactionHash(null);
  }, [resetStates]);

  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);

  const confirmWrap = useCallback(async () => {
    if (!activePublicKey) return;

    setStep('signing');
    setError(null);
    updateTransactionState('wrap', 'pending');

    const callbacks: ITransactionCallbacks = {
      onSent: hash => {
        setTransactionHash(hash);
        updateTransactionState('wrap', 'awaiting');
      },
      onProcessed: () => {
        updateTransactionState('wrap', 'success');
        setStep('success');
        // Refetch balances as soon as the transaction succeeds (not on modal close), so the form
        // behind the success modal reflects the new CSPR / WCSPR balances immediately.
        onWrapSuccess();
      },
      onError: txError => {
        updateTransactionState('wrap', 'error');
        setError(getTransactionErrorMessage(txError));
      },
      // Treat a wallet rejection like any other failure: stay on the signing step and surface
      // the error. onError follows onCancelled and will set the message.
      onCancelled: () => {
        updateTransactionState('wrap', 'error');
      },
    };

    const params: IUseWrapTransactionParams = {
      direction,
      rawAmount: sourceToken.amountRaw,
      publicKey: activePublicKey,
    };

    try {
      await execute(params, callbacks);
    } catch (txError) {
      updateTransactionState('wrap', 'error');
      setError(getTransactionErrorMessage(txError));
    }
  }, [
    activePublicKey,
    direction,
    execute,
    onWrapSuccess,
    sourceToken.amountRaw,
    updateTransactionState,
  ]);

  const handleCloseSuccessModal = useCallback(() => {
    onClose();
  }, [onClose]);

  return {
    step,
    status,
    error,
    transactionHash,
    isProcessing: step === 'signing' && status !== 'success',
    confirmWrap,
    handleCloseSuccessModal,
  };
};
