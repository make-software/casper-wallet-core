import type { CasperNetwork } from '../common';

/** How long between settlement polls, and how long to keep polling before giving up. */
export const DEFAULT_SETTLEMENT_POLL_INTERVAL_MS = 2_000;
export const DEFAULT_SETTLEMENT_TIMEOUT_MS = 180_000;

export type TransactionOutcomeStatus = 'success' | 'failure';

/** A transaction that has executed on chain. A transaction still in flight has no outcome. */
export interface ITransactionOutcome {
  hash: string;
  status: TransactionOutcomeStatus;
  blockHeight: number;
  /** The node's execution error. Present only when `status` is 'failure'. */
  errorMessage?: string;
}

export interface IWaitForTransactionParams {
  hash: string;
  network: CasperNetwork;
  /** True when the hash was submitted as a legacy Deploy (node 1.x) rather than a TransactionV1. */
  isDeploy: boolean;
  /** Default {@link DEFAULT_SETTLEMENT_POLL_INTERVAL_MS}. */
  pollIntervalMs?: number;
  /** Default {@link DEFAULT_SETTLEMENT_TIMEOUT_MS}. */
  timeoutMs?: number;
}
