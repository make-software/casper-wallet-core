import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import { initialWrapFlowState, wrapFlowReducer } from '../../../domain/flows';
import type { IStartWrapFlowParams, IWrapFlowHandle } from '../../../domain/flows';
import type { WrapDirection } from '../../../domain/dex';
import type { IDexTokenWithAmount } from '../../../domain/swap';
import type { ISwapDependencies } from '../../types';

export interface IUseReviewWrapParams extends Pick<
  ISwapDependencies,
  'network' | 'activePublicKey' | 'wrapFlowRunner'
> {
  direction: WrapDirection;
  sourceToken: IDexTokenWithAmount;
  isOpen: boolean;
  onWrapSuccess: () => void;
  onClose: () => void;
}

/**
 * Subscribes the review modal to a running wrap flow. Closing the modal (`isOpen: false`)
 * unsubscribes but never cancels the handle, so a submitted wrap keeps running and reopening
 * replays the flow's history. Only `handle.cancel()` stops a flow.
 */
export const useReviewWrap = ({
  activePublicKey,
  wrapFlowRunner,
  direction,
  sourceToken,
  isOpen,
  onWrapSuccess,
  onClose,
}: IUseReviewWrapParams) => {
  const [handle, setHandle] = useState<IWrapFlowHandle | null>(null);
  const [state, dispatch] = useReducer(wrapFlowReducer, initialWrapFlowState);
  const succeededRef = useRef(false);
  // `confirmWrap` can be invoked twice within the same tick, before the `handle` state update
  // from the first call has re-rendered — a ref guards synchronously where state cannot.
  const handleRef = useRef<IWrapFlowHandle | null>(null);
  // Held in a ref rather than a dependency: an inline callback would change identity every
  // render, resubscribing and restarting the fold.
  const onWrapSuccessRef = useRef(onWrapSuccess);
  onWrapSuccessRef.current = onWrapSuccess;

  useEffect(() => {
    // Unsubscribing while the surface is closed only stops the hook from applying events; the
    // flow keeps running. `events$` is replayed, so reopening re-folds the whole history onto the
    // state already folded — every reducer case overwrites, so that converges rather than doubles.
    if (!handle || !isOpen) return;

    const subscription = handle.events$.subscribe({
      next: event => {
        dispatch(event);

        if (event.type === 'wrap:confirmed' && !succeededRef.current) {
          succeededRef.current = true;
          onWrapSuccessRef.current();
        }
      },
      // The flow itself never errors the stream; a merged `ledgerEvents$` still can, and without
      // a handler rxjs would rethrow it out of band, leaving the modal on `confirm` with no reason.
      error: (error: unknown) => dispatch({ type: 'failed', error }),
    });

    // Unsubscribe only — cancelling here would abandon a submitted wrap.
    return () => subscription.unsubscribe();
  }, [handle, isOpen]);

  const confirmWrap = useCallback(() => {
    if (handleRef.current || !wrapFlowRunner || !activePublicKey) return;

    const params: IStartWrapFlowParams = {
      direction,
      rawAmount: sourceToken.amountRaw,
    };

    const newHandle = wrapFlowRunner.start(params);
    handleRef.current = newHandle;
    setHandle(newHandle);
  }, [activePublicKey, direction, sourceToken.amountRaw, wrapFlowRunner]);

  const handleCloseSuccessModal = useCallback(() => {
    onClose();
  }, [onClose]);

  return {
    step: state.step,
    status: state.wrap.status,
    error: state.wrap.error ?? null,
    transactionHash: state.wrap.hash ?? null,
    isProcessing: state.step === 'signing',
    confirmWrap,
    handleCloseSuccessModal,
    ledgerEvent: state.ledgerEvent,
  };
};
