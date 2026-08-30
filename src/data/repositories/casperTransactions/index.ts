import { RpcClient } from 'casper-js-sdk';
import { isBefore, sub } from 'date-fns';
import {
  CasperNetwork,
  CasperTransactionsError,
  CasperTransactionsErrorType,
  ICasperRpcOptions,
  isCasperTransactionsError,
} from '../../../domain';
import { createCasperRpcClient } from '../../../utils/casperSdk/rpcClient';

export class CasperTransactionsRepository {
  constructor(
    private _grpcUrl: Record<CasperNetwork, string>,
    private _rpcOptions: ICasperRpcOptions = {},
  ) {}

  async getNetworkApiVersion(network: CasperNetwork): Promise<string> {
    try {
      const resp = await this._createRpcClient(network).getStatus();

      return resp.apiVersion;
    } catch (e) {
      this._processError(e, 'getNetworkApiVersion');
    }
  }

  protected _createRpcClient(network: CasperNetwork): RpcClient {
    return createCasperRpcClient(this._grpcUrl[network], this._rpcOptions);
  }

  async getDateForTransaction(network: CasperNetwork): Promise<string> {
    const defaultDate = sub(new Date(), { seconds: 2 });

    try {
      const resp = await this._createRpcClient(network).getStatus();
      const nodeDate = resp.lastProgress.toDate();

      return isBefore(nodeDate, defaultDate) ? defaultDate.toISOString() : nodeDate.toISOString();
    } catch {
      return defaultDate.toISOString();
    }
  }

  protected _processError(e: unknown, type: CasperTransactionsErrorType): never {
    if (isCasperTransactionsError(e)) {
      throw e;
    }

    throw new CasperTransactionsError(e, type);
  }
}
