import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import { initialSwapFlowState, swapFlowReducer } from '../../../domain/flows';
import type {
  ISwapFlowState,
  IStartSwapFlowParams,
  ISwapFlowHandle,
  SwapFlowEvent,
} from '../../../domain/flows';
import type { IDexTokenWithAmount, SwapQuoteType } from '../../../domain/swap';
import type { ISwapDependencies, TransactionStatus } from '../../types';

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
  const [state, dispatch] = useReducer(swapViewReducer, initialSwapFlowState);
  const succeededRef = useRef(false);
  // `confirmSwap` can be invoked twice within the same tick, before the `handle` state update
  // from the first call has re-rendered — a ref guards synchronously where state cannot.
  const handleRef = useRef<ISwapFlowHandle | null>(null);
  // Held in a ref rather than depended on: a consumer passing an inline callback would otherwise
  // change its identity every render, resubscribing and restarting the fold each time.
  const onSwapSuccessRef = useRef(onSwapSuccess);
  onSwapSuccessRef.current = onSwapSuccess;

  useEffect(() => {
    // Gated on `isOpen`, not torn down forever: unsubscribing here only stops the hook from
    // applying events while the surface is closed. It never cancels the flow (D4), and a real
    // handle's `events$` is `shareReplay`d, so resubscribing on reopen replays the full history
    // onto the state already folded. Every case here overwrites rather than accumulates, so the
    // replay converges on the flow's true current state instead of double-counting.
    if (!handle || !isOpen) return;

    const subscription = handle.events$.subscribe(event => {
      dispatch(event);

      if (event.type === 'swap:confirmed' && !succeededRef.current) {
        succeededRef.current = true;
        onSwapSuccessRef.current();
      }
    });

    // Unsubscribe only — cancelling here would abandon a submitted swap (D4).
    return () => subscription.unsubscribe();
  }, [handle, isOpen]);

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
