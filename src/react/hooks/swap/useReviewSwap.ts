import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import { initialSwapFlowState, swapFlowReducer } from '../../../domain/flows';
import type {
  ISwapFlowState,
  IStartSwapFlowParams,
  ISwapFlowHandle,
  ISwapQuotedTrade,
  SwapFlowEvent,
} from '../../../domain/flows';
import { FlowError } from '../../../domain/flows';
import type { ISwapDependencies, TransactionStatus } from '../../types';

export interface IUseReviewSwapParams extends Pick<
  ISwapDependencies,
  'network' | 'activePublicKey' | 'swapFlowRunner'
> {
  /** Max slippage in percent — the same value passed to the swap build. */
  slippage: number;
  /** Transaction deadline in minutes. */
  deadline: number;
  /**
   * The tokens, amounts, route and quote type of one quote — `useSwapTokens` returns it as
   * `quotedTrade`. `null` while no quote is in hand, which makes `confirmSwap` a no-op.
   */
  trade: ISwapQuotedTrade | null;
  isOpen: boolean;
  onSwapSuccess: () => void;
  onClose: () => void;
}

/** `reset` is a view concern the runner never emits — it backs `resetForm`. */
type SwapViewEvent = SwapFlowEvent | { type: 'reset' };

const swapViewReducer = (state: ISwapFlowState, event: SwapViewEvent): ISwapFlowState =>
  event.type === 'reset' ? initialSwapFlowState : swapFlowReducer(state, event);

export interface ISwapTransactionState {
  approval: {
    isRequired: boolean;
    status: TransactionStatus;
    transactionHash?: string;
    error?: string;
  };
  swap: { status: TransactionStatus; error?: string };
}

/**
 * Subscribes the review modal to a running swap flow. Closing the modal (`isOpen: false`)
 * unsubscribes but never cancels the handle, so a submitted swap keeps running and reopening
 * replays the flow's history. Only `handle.cancel()` stops a flow.
 */
export const useReviewSwap = ({
  activePublicKey,
  swapFlowRunner,
  slippage,
  deadline,
  trade,
  isOpen,
  onSwapSuccess,
  onClose,
}: IUseReviewSwapParams) => {
  const [handle, setHandle] = useState<ISwapFlowHandle | null>(null);
  const [state, dispatch] = useReducer(swapViewReducer, initialSwapFlowState);
  const succeededRef = useRef(false);
  // Non-null exactly while a flow is live. A ref rather than state because `confirmSwap` can be
  // invoked twice within the same tick, before the first call's `handle` update has re-rendered.
  const handleRef = useRef<ISwapFlowHandle | null>(null);
  // Held in a ref rather than a dependency: an inline callback would change identity every
  // render, resubscribing and restarting the fold.
  const onSwapSuccessRef = useRef(onSwapSuccess);
  onSwapSuccessRef.current = onSwapSuccess;

  const releaseGuard = useCallback((settled: ISwapFlowHandle) => {
    if (handleRef.current === settled) {
      handleRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Unsubscribing while the surface is closed only stops the hook from applying events; the
    // flow keeps running. `events$` is replayed, so reopening re-folds the whole history onto the
    // state already folded — every reducer case overwrites, so that converges rather than doubles.
    if (!handle || !isOpen) return;

    const subscription = handle.events$.subscribe({
      next: event => {
        dispatch(event);

        if (event.type === 'swap:confirmed' && !succeededRef.current) {
          succeededRef.current = true;
          onSwapSuccessRef.current();
        }
      },
      // The flow itself never errors the stream; a merged `ledgerEvents$` still can, and without
      // a handler rxjs would rethrow it out of band, leaving the modal on `confirm` with no reason.
      error: (error: unknown) => dispatch({ type: 'failed', leg: 'swap', error }),
    });

    // Unsubscribe only — cancelling here would abandon a submitted swap.
    return () => subscription.unsubscribe();
  }, [handle, isOpen]);

  const confirmSwap = useCallback(() => {
    if (handleRef.current || !swapFlowRunner || !activePublicKey || !trade) return;

    if (swapFlowRunner.publicKey !== activePublicKey) {
      dispatch({
        type: 'failed',
        leg: 'swap',
        error: new FlowError('runner-account-mismatch'),
      });

      return;
    }

    const params: IStartSwapFlowParams = { ...trade, slippage, deadline };

    const newHandle = swapFlowRunner.start(params);
    handleRef.current = newHandle;
    setHandle(newHandle);
    // The guard tracks liveness, not identity: every terminal path resolves `done`, and only that
    // releases it. Clearing on the subscription instead would miss a flow that ended while closed.
    const release = () => releaseGuard(newHandle);
    newHandle.done.then(release, release);
  }, [activePublicKey, deadline, releaseGuard, slippage, swapFlowRunner, trade]);

  const resetForm = useCallback(() => {
    // Refusing while a flow is live is what stops a second approval and a second swap against the
    // same balance. Stopping a flow is `handle.cancel()`, never this.
    if (handleRef.current) return;

    succeededRef.current = false;
    setHandle(null);
    dispatch({ type: 'reset' });
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
