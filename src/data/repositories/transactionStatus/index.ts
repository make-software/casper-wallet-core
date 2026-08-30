import {
  catchError,
  defer,
  first,
  firstValueFrom,
  merge,
  Observable,
  of,
  repeat,
  tap,
  throwError,
  timeout,
} from 'rxjs';

import { createCasperRpcClient } from '../../../utils/casperSdk/rpcClient';
import {
  DEFAULT_LOOKUP_GRACE_MS,
  DEFAULT_SETTLEMENT_POLL_INTERVAL_MS,
  DEFAULT_SETTLEMENT_TIMEOUT_MS,
  TransactionStatusError,
  TransactionTimeoutError,
  TransactionWatchCancelledError,
} from '../../../domain/transactionStatus';
import type {
  ITransactionOutcome,
  ITransactionStatusRepository,
  IWaitForTransactionParams,
} from '../../../domain/transactionStatus';
import type { CasperNetwork, ICasperRpcOptions } from '../../../domain';

type RpcClient = ReturnType<typeof createCasperRpcClient>;

/** `ErrorCode.NoSuchDeploy` / `ErrorCode.NoSuchTransaction` — the node has not seen the hash yet. */
const PENDING_RPC_CODES = [-32000, -32014];

/**
 * The sdk reports an RPC error as `HttpError(code, RpcError)`, so the code sits on `statusCode`
 * and on the wrapped `sourceErr` — never on the thrown error itself.
 */
const rpcErrorCodes = (error: unknown): number[] => {
  if (typeof error !== 'object' || error === null) {
    return [];
  }

  const { code, statusCode, sourceErr } = error as {
    code?: unknown;
    statusCode?: unknown;
    sourceErr?: { code?: unknown };
  };

  return [code, statusCode, sourceErr?.code].filter(value => value != null).map(Number);
};

const isPendingRpcError = (error: unknown): boolean =>
  rpcErrorCodes(error).some(code => PENDING_RPC_CODES.includes(code));

/** Turns "the node has not seen the hash yet" into an empty lookup; rethrows anything else. */
const pendingOrRethrow = (error: unknown): undefined => {
  if (isPendingRpcError(error)) {
    return undefined;
  }

  throw error;
};

/** Errors on abort and never emits, so merging it into a watch cancels the watch. */
const abortAsError$ = (signal: AbortSignal, hash: string): Observable<never> =>
  new Observable<never>(subscriber => {
    const fail = () => subscriber.error(new TransactionWatchCancelledError(hash));

    signal.addEventListener('abort', fail, { once: true });

    return () => signal.removeEventListener('abort', fail);
  });

export class TransactionStatusRepository implements ITransactionStatusRepository {
  constructor(
    private _grpcUrl: Record<CasperNetwork, string>,
    private _rpcOptions: ICasperRpcOptions = {},
  ) {}

  observeTransaction(params: IWaitForTransactionParams): Observable<ITransactionOutcome> {
    const {
      hash,
      network,
      signal,
      pollIntervalMs = DEFAULT_SETTLEMENT_POLL_INTERVAL_MS,
      timeoutMs = DEFAULT_SETTLEMENT_TIMEOUT_MS,
      lookupGraceMs = DEFAULT_LOOKUP_GRACE_MS,
    } = params;

    const maxConsecutiveFailures = Math.max(1, Math.ceil(lookupGraceMs / pollIntervalMs));

    const poll$ = defer((): Observable<ITransactionOutcome> => {
      if (signal?.aborted) {
        return throwError(() => new TransactionWatchCancelledError(hash));
      }

      const rpcClient = createCasperRpcClient(this._grpcUrl[network], this._rpcOptions);
      let consecutiveFailures = 0;

      return defer(() => this._lookup(rpcClient, params)).pipe(
        tap(() => {
          consecutiveFailures = 0;
        }),
        // A single failed lookup says nothing about the transaction, so the node is only called
        // unreachable once the grace window of back-to-back failures is spent.
        catchError((error: unknown) => {
          consecutiveFailures += 1;

          return consecutiveFailures > maxConsecutiveFailures
            ? throwError(() => new TransactionStatusError(error, 'lookup'))
            : of(null);
        }),
        // `repeat` waits out the interval after each lookup returns. A timer-driven poll would
        // instead queue every tick a slow lookup overran and then fire them back to back.
        repeat({ delay: pollIntervalMs }),
        first((outcome): outcome is ITransactionOutcome => outcome !== null),
        timeout({
          each: timeoutMs,
          with: () => throwError(() => new TransactionTimeoutError(hash)),
        }),
      );
    });

    return signal ? merge(poll$, abortAsError$(signal, hash)) : poll$;
  }

  waitForTransaction(params: IWaitForTransactionParams): Promise<ITransactionOutcome> {
    return firstValueFrom(this.observeTransaction(params));
  }

  /** `null` means "not executed yet" — the caller polls again. */
  private async _lookup(
    rpcClient: RpcClient,
    { hash, isDeploy }: IWaitForTransactionParams,
  ): Promise<ITransactionOutcome | null> {
    const result = isDeploy
      ? await rpcClient.getTransactionByDeployHash(hash).catch(pendingOrRethrow)
      : await rpcClient.getTransactionByTransactionHash(hash).catch(pendingOrRethrow);

    const executionInfo = result?.executionInfo;

    if (!executionInfo) {
      return null;
    }

    const errorMessage = executionInfo.executionResult?.errorMessage;

    return {
      hash,
      status: errorMessage ? 'failure' : 'success',
      blockHeight: executionInfo.blockHeight,
      ...(errorMessage ? { errorMessage } : {}),
    };
  }
}
