import type { Observable } from 'rxjs'; // type-only — the sdk-free gate and domain purity
import type { ITransactionOutcome, IWaitForTransactionParams } from './entities';

export interface ITransactionStatusRepository {
  /**
   * Polls the node until the transaction has executed, then emits exactly one
   * {@link ITransactionOutcome} and completes.
   *
   * Cold: every subscription starts its own poll. Errors with `TransactionTimeoutError` when
   * `timeoutMs` elapses first, `TransactionStatusError` of type `'lookup'` when the node stays
   * unreachable for `lookupGraceMs`, or `TransactionWatchCancelledError` when `signal` aborts.
   */
  observeTransaction(params: IWaitForTransactionParams): Observable<ITransactionOutcome>;
  /**
   * Promise facade over {@link observeTransaction}, for callers that do not want rxjs.
   *
   * @throws {TransactionTimeoutError} when the transaction has not executed within `timeoutMs`.
   * @throws {TransactionStatusError} of type `'lookup'` when the node cannot be reached for
   * `lookupGraceMs` of consecutive polls.
   * @throws {TransactionWatchCancelledError} when `signal` aborts.
   */
  waitForTransaction(params: IWaitForTransactionParams): Promise<ITransactionOutcome>;
}
