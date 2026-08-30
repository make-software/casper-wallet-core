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
 * Subscribes the review modal to a running wrap flow instead of owning the orchestration
 * itself. Closing the modal (`isOpen: false`) unsubscribes but never cancels the handle — only
 * the explicit `handle.cancel()` does that — so a submitted wrap keeps running, and reopening
 * replays the flow's history to re-render whatever it has actually reached.
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
  // Held in a ref rather than depended on: a consumer passing an inline callback would otherwise
  // change its identity every render, resubscribing and restarting the fold each time.
  const onWrapSuccessRef = useRef(onWrapSuccess);
  onWrapSuccessRef.current = onWrapSuccess;

  useEffect(() => {
    // Gated on `isOpen`, not torn down forever: unsubscribing here only stops the hook from
    // applying events while the surface is closed. It never cancels the flow (D4), and a real
    // handle's `events$` is `shareReplay`d, so resubscribing on reopen replays the full history
    // onto the state already folded. Every case here overwrites rather than accumulates, so the
    // replay converges on the flow's true current state instead of double-counting.
    if (!handle || !isOpen) return;

    const subscription = handle.events$.subscribe(event => {
      dispatch(event);

      if (event.type === 'wrap:confirmed' && !succeededRef.current) {
        succeededRef.current = true;
        onWrapSuccessRef.current();
      }
    });

    // Unsubscribe only — cancelling here would abandon a submitted wrap (D4).
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
  };
};
