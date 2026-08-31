import { DEX_TRANSACTION_TTL_MS } from '../constants';
import type { CasperNetwork } from '../common';

/** How long between settlement polls, and how long to keep polling before giving up. */
export const DEFAULT_SETTLEMENT_POLL_INTERVAL_MS = 2_000;
/** Matches the TTL transactions are built with, so a timeout means the hash can no longer land. */
export const DEFAULT_SETTLEMENT_TIMEOUT_MS = DEX_TRANSACTION_TTL_MS;
/** How long lookups may keep failing before the node is called unreachable. */
export const DEFAULT_LOOKUP_GRACE_MS = 60_000;

export type TransactionOutcomeStatus = 'success' | 'failure';

interface ITransactionOutcomeBase {
  hash: string;
  blockHeight: number;
}

/** Executed and did what it was asked. */
export interface ITransactionSuccessOutcome extends ITransactionOutcomeBase {
  status: 'success';
  errorMessage?: never;
}

/** Executed and reverted. `errorMessage` is the node's own execution error. */
export interface ITransactionFailureOutcome extends ITransactionOutcomeBase {
  status: 'failure';
  errorMessage?: string;
}

/**
 * A transaction that has executed on chain. A transaction still in flight has no outcome, and a
 * settlement that timed out has none either — "we stopped waiting" is not "the chain rejected it".
 *
 * Discriminated on `status` so a consumer cannot read `errorMessage` off a success, and an event
 * or result that means "this landed" can be typed against
 * {@link ITransactionSuccessOutcome} alone.
 */
export type ITransactionOutcome = ITransactionSuccessOutcome | ITransactionFailureOutcome;

export interface IWaitForTransactionParams {
  hash: string;
  network: CasperNetwork;
  /** True when the hash was submitted as a legacy Deploy (node 1.x) rather than a TransactionV1. */
  isDeploy: boolean;
  /** Default {@link DEFAULT_SETTLEMENT_POLL_INTERVAL_MS}. */
  pollIntervalMs?: number;
  /** Default {@link DEFAULT_SETTLEMENT_TIMEOUT_MS}. */
  timeoutMs?: number;
  /**
   * How long a run of failing lookups is tolerated before the watch reports the node unreachable.
   * A single failed poll never ends the watch — the transaction may be landing regardless.
   * Default {@link DEFAULT_LOOKUP_GRACE_MS}.
   */
  lookupGraceMs?: number;
  /** Aborting ends the watch and rejects with {@link TransactionWatchCancelledError}. */
  signal?: AbortSignal;
}
