// type-only: the domain layer takes no runtime rxjs dependency
import type { Observable } from 'rxjs';
import type { WrapDirection } from '../dex';
import type { ILedgerEvent } from '../ledger';
import type { IDexTokenWithAmount, SwapQuoteType } from '../swap';
import type { ITransactionOutcome } from '../transactionStatus';

/** Per-leg progress. 'awaiting' means submitted and waiting for the chain. */
export type TransactionStatus = 'idle' | 'pending' | 'awaiting' | 'success' | 'error';

export type SwapLeg = 'approval' | 'swap';

export type SwapFlowEvent =
  | { type: 'approval:checking' }
  | { type: 'approval:not-required' }
  | { type: 'approval:signing' }
  | { type: 'approval:sent'; hash: string }
  | { type: 'approval:confirmed' }
  | { type: 'swap:signing' }
  | { type: 'swap:sent'; hash: string }
  | { type: 'swap:confirmed'; outcome: ITransactionOutcome }
  | { type: 'ledger'; event: ILedgerEvent }
  | { type: 'cancelled'; leg: SwapLeg }
  | { type: 'failed'; leg: SwapLeg; error: unknown };

export type WrapFlowEvent =
  | { type: 'wrap:signing' }
  | { type: 'wrap:sent'; hash: string }
  | { type: 'wrap:confirmed'; outcome: ITransactionOutcome }
  | { type: 'ledger'; event: ILedgerEvent }
  | { type: 'cancelled' }
  | { type: 'failed'; error: unknown };

/**
 * A running flow.
 *
 * `events$` is **hot and replayed**: a late subscriber receives every event so far, and
 * unsubscribing does **not** stop the flow — a closed UI surface must not abandon a submitted
 * transaction. Stopping is only ever {@link IFlowHandle.cancel}.
 */
export interface IFlowHandle<TEvent, TResult> {
  readonly id: string;
  readonly events$: Observable<TEvent>;
  /** Resolves when the flow reaches a terminal state. Never rejects. */
  readonly done: Promise<TResult>;
  cancel(): void;
}

export type FlowStatus = 'success' | 'failed' | 'cancelled';

export interface ISwapFlowResult {
  status: FlowStatus;
  approvalHash?: string;
  swapHash?: string;
  outcome?: ITransactionOutcome;
  error?: unknown;
}

export interface IWrapFlowResult {
  status: FlowStatus;
  wrapHash?: string;
  outcome?: ITransactionOutcome;
  error?: unknown;
}

export type ISwapFlowHandle = IFlowHandle<SwapFlowEvent, ISwapFlowResult>;
export type IWrapFlowHandle = IFlowHandle<WrapFlowEvent, IWrapFlowResult>;

export interface IStartSwapFlowParams {
  firstToken: IDexTokenWithAmount;
  secondToken: IDexTokenWithAmount;
  path: string[];
  quoteType: SwapQuoteType;
  /** Max slippage in percent. Clamp with `clampSlippageValue` before passing it in. */
  slippage: number;
  /** Deadline in minutes. Clamp with `clampDeadlineValue` before passing it in. */
  deadline: number;
  /**
   * Wait for the swap itself to settle before completing. Default `true`. The approval leg is
   * always awaited regardless — submitting a swap before its allowance is on chain reverts it.
   */
  awaitSettlement?: boolean;
}

export interface IStartWrapFlowParams {
  direction: WrapDirection;
  /** Raw units: motes to wrap, or WCSPR units to burn. */
  rawAmount: string;
  awaitSettlement?: boolean;
}

export interface ISwapFlowRunner {
  start(params: IStartSwapFlowParams): ISwapFlowHandle;
  /** The handle for a still-running flow, so a remounted surface can reattach. */
  getActive(id: string): ISwapFlowHandle | null;
}

export interface IWrapFlowRunner {
  start(params: IStartWrapFlowParams): IWrapFlowHandle;
  getActive(id: string): IWrapFlowHandle | null;
}
