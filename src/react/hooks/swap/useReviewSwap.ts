import { useCallback, useEffect, useRef, useState } from 'react';

import { initialSwapFlowState, swapFlowReducer } from '../../../domain/flows';
import type { IStartSwapFlowParams, ISwapFlowHandle } from '../../../domain/flows';
import type { IDexTokenWithAmount, SwapQuoteType } from '../../../domain/swap';
import type { ApprovalState, ISwapDependencies, TransactionStatus } from '../../types';

export interface IUseReviewSwapParams extends Pick<
  ISwapDependencies,
  'network' | 'activePublicKey' | 'swapFlowRunner'
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
 * Subscribes the review modal to a running swap flow instead of owning the orchestration
 * itself. Closing the modal (`isOpen: false`) unsubscribes but never cancels the handle — only
 * the explicit `handle.cancel()` does that — so a submitted swap keeps running, and reopening
 * replays the flow's history to re-render whatever it has actually reached.
 */
export const useReviewSwap = ({
  activePublicKey,
  swapFlowRunner,
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
  const [handle, setHandle] = useState<ISwapFlowHandle | null>(null);
  const [state, setState] = useState(initialSwapFlowState);
  const succeededRef = useRef(false);
  // `confirmSwap` can be invoked twice within the same tick, before the `handle` state update
  // from the first call has re-rendered — a ref guards synchronously where state cannot.
  const handleRef = useRef<ISwapFlowHandle | null>(null);

  useEffect(() => {
    // Gated on `isOpen`, not torn down forever: unsubscribing here only stops the hook from
    // applying events while the surface is closed. It never cancels the flow (D4), and a real
    // handle's `events$` is `shareReplay`d, so resubscribing on reopen replays the full history
    // and `next` reconstructs the flow's true current state rather than a stale one.
    if (!handle || !isOpen) return;

    let next = initialSwapFlowState;
    const subscription = handle.events$.subscribe(event => {
      next = swapFlowReducer(next, event);
      setState(next);

      if (event.type === 'swap:confirmed' && !succeededRef.current) {
        succeededRef.current = true;
        onSwapSuccess();
      }
    });

    // Unsubscribe only — cancelling here would abandon a submitted swap (D4).
    return () => subscription.unsubscribe();
  }, [handle, isOpen, onSwapSuccess]);

  const confirmSwap = useCallback(() => {
    if (handleRef.current || !swapFlowRunner || !activePublicKey) return;

    const params: IStartSwapFlowParams = {
      firstToken,
      secondToken,
      path,
      quoteType,
      slippage,
      deadline,
    };

    const newHandle = swapFlowRunner.start(params);
    handleRef.current = newHandle;
    setHandle(newHandle);
  }, [
    activePublicKey,
    deadline,
    firstToken,
    path,
    quoteType,
    secondToken,
    slippage,
    swapFlowRunner,
  ]);

  const resetForm = useCallback(() => {
    succeededRef.current = false;
    handleRef.current = null;
    setHandle(null);
    setState(initialSwapFlowState);
  }, []);

  const transactionState: ISwapTransactionState = {
    approval: {
      isRequired: state.approval.isRequired,
      status: state.approval.status,
      transactionHash: state.approval.hash,
      error: state.approval.error,
    },
    swap: {
      status: state.swap.status,
      error: state.swap.error,
    },
  };

  const handleCloseSuccessModal = useCallback(() => {
    onClose();
  }, [onClose]);

  return {
    step: state.step,
    transactionState,
    isProcessing: state.step === 'signing',
    confirmSwap,
    resetForm,
    handleCloseSuccessModal,
    transactionHash: state.swap.hash ?? null,
    ledgerEvent: state.ledgerEvent,
  };
};
