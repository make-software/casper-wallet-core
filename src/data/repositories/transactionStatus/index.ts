import { concatMap, defer, first, firstValueFrom, retry, throwError, timeout, timer } from 'rxjs';

import { createCasperRpcClient } from '../../../utils/casperSdk/rpcClient';
import {
  DEFAULT_SETTLEMENT_POLL_INTERVAL_MS,
  DEFAULT_SETTLEMENT_TIMEOUT_MS,
  TransactionStatusError,
  TransactionTimeoutError,
} from '../../../domain/transactionStatus';
import type {
  ITransactionOutcome,
  ITransactionStatusRepository,
  IWaitForTransactionParams,
} from '../../../domain/transactionStatus';
import type { CasperNetwork, ICasperRpcOptions } from '../../../domain';

/** `ErrorCode.NoSuchDeploy` / `ErrorCode.NoSuchTransaction` — the node has not seen the hash yet. */
const PENDING_RPC_CODES = [-32000, -32014];

const isPendingRpcError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  PENDING_RPC_CODES.includes(Number((error as { code: unknown }).code));

export class TransactionStatusRepository implements ITransactionStatusRepository {
  constructor(
    private _grpcUrl: Record<CasperNetwork, string>,
    private _rpcOptions: ICasperRpcOptions = {},
  ) {}

  observeTransaction(params: IWaitForTransactionParams) {
    const {
      hash,
      pollIntervalMs = DEFAULT_SETTLEMENT_POLL_INTERVAL_MS,
      timeoutMs = DEFAULT_SETTLEMENT_TIMEOUT_MS,
    } = params;

    return timer(0, pollIntervalMs).pipe(
      concatMap(() => defer(() => this._lookup(params)).pipe(retry({ count: 2, delay: 1_000 }))),
      first((outcome): outcome is ITransactionOutcome => outcome !== null),
      timeout({ each: timeoutMs, with: () => throwError(() => new TransactionTimeoutError(hash)) }),
    );
  }

  waitForTransaction(params: IWaitForTransactionParams): Promise<ITransactionOutcome> {
    return firstValueFrom(this.observeTransaction(params));
  }

  /** `null` means "not executed yet" — the caller polls again. */
  private async _lookup({
    hash,
    network,
    isDeploy,
  }: IWaitForTransactionParams): Promise<ITransactionOutcome | null> {
    const rpcClient = createCasperRpcClient(this._grpcUrl[network], this._rpcOptions);

    try {
      const result = isDeploy
        ? await rpcClient.getTransactionByDeployHash(hash)
        : await rpcClient.getTransactionByTransactionHash(hash);

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
    } catch (error) {
      if (isPendingRpcError(error)) {
        return null;
      }

      throw error instanceof TransactionStatusError
        ? error
        : new TransactionStatusError(error, 'lookup');
    }
  }
}
