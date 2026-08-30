import { useCallback, useEffect, useRef, useState } from 'react';

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
  const [state, setState] = useState(initialWrapFlowState);
  const succeededRef = useRef(false);
  // `confirmWrap` can be invoked twice within the same tick, before the `handle` state update
  // from the first call has re-rendered — a ref guards synchronously where state cannot.
  const handleRef = useRef<IWrapFlowHandle | null>(null);

  useEffect(() => {
    // Gated on `isOpen`, not torn down forever: unsubscribing here only stops the hook from
    // applying events while the surface is closed. It never cancels the flow (D4), and a real
    // handle's `events$` is `shareReplay`d, so resubscribing on reopen replays the full history
    // and `next` reconstructs the flow's true current state rather than a stale one.
    if (!handle || !isOpen) return;

    let next = initialWrapFlowState;
    const subscription = handle.events$.subscribe(event => {
      next = wrapFlowReducer(next, event);
      setState(next);

      if (event.type === 'wrap:confirmed' && !succeededRef.current) {
        succeededRef.current = true;
        onWrapSuccess();
      }
    });

    // Unsubscribe only — cancelling here would abandon a submitted wrap (D4).
    return () => subscription.unsubscribe();
  }, [handle, isOpen, onWrapSuccess]);

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
