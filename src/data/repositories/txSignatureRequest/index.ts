import {
  CasperNetwork,
  CasperWalletApiUrl,
  CSPR_API_PROXY_HEADERS,
  DataResponse,
  GrpcUrl,
  IAccountInfoRepository,
  IHttpDataProvider,
  InvalidTransactionJsonError,
  IPrepareSignatureRequestParams,
  isError,
  isTxSignatureRequestError,
  ITokensRepository,
  ITxSignatureRequest,
  ITxSignatureRequestRepository,
  TxSignatureRequestError,
  TxSignatureRequestErrorType,
} from '../../../domain';
import {
  HttpHandler,
  RpcClient,
  Transaction,
  TransactionError,
  TransactionEntryPointEnum,
  CasperNetworkName,
  AccountIdentifier,
  StateGetAccountInfo,
} from 'casper-js-sdk';
import { IContractPackageCloudResponse } from './types';
import { getCasperNetworkByChainName } from '../../../utils';
import {
  checkIsWasmProxyTx,
  getAccountHashesFromTxSignatureRequest,
  getWasmProxyContractPackageHash,
  TxSignatureRequestDto,
} from '../../dto';

export * from './types';

export class TxSignatureRequestRepository implements ITxSignatureRequestRepository {
  constructor(
    private _httpProvider: IHttpDataProvider,
    private _accountInfoRepository: IAccountInfoRepository,
    private _tokensRepository: ITokensRepository,
  ) {}

  async prepareSignatureRequest({
    transactionJson,
    signingPublicKeyHex,
    withProxyHeader = true,
  }: IPrepareSignatureRequestParams): Promise<ITxSignatureRequest> {
    try {
      const tx = Transaction.fromJSON(transactionJson);

      const network = getCasperNetworkByChainName(tx.chainName as CasperNetworkName);

      if (!network) {
        return new TxSignatureRequestDto(tx, network, signingPublicKeyHex, '0', {}, null, {});
      }

      let csprRate = '0';
      let contractPackage: IContractPackageCloudResponse | null = null;
      let rpcAccountsInfo: Record<string, StateGetAccountInfo> | null = null;

      try {
        const rateResp = await this._tokensRepository.getCsprFiatCurrencyRate({
          network,
          withProxyHeader,
        });
        csprRate = rateResp.rate.toString();
      } catch (e) {}

      try {
        contractPackage = await this._processContractPackage(tx, network, withProxyHeader);
      } catch (e) {}

      const rawSignatureRequest = new TxSignatureRequestDto(
        tx,
        network,
        signingPublicKeyHex,
        csprRate,
        {},
        contractPackage,
        {},
      );

      try {
        const accountHashes = getAccountHashesFromTxSignatureRequest(rawSignatureRequest);

        await this._accountInfoRepository.getAccountsInfo({
          network,
          accountHashes,
        });
      } catch (e) {}

      try {
        const handler = new HttpHandler(GrpcUrl[network], 'fetch');

        if (withProxyHeader) {
          handler.setReferrer(CSPR_API_PROXY_HEADERS.Referer);
        }

        const rpcClient = new RpcClient(handler);

        const entries = await Promise.all(
          tx.approvals
            .map(a => a.signer)
            .map<
              Promise<[string, StateGetAccountInfo]>
            >(async pk => [pk.toHex(), await rpcClient.getAccountInfo(null, new AccountIdentifier(undefined, pk))]),
        );

        rpcAccountsInfo = Object.fromEntries<StateGetAccountInfo>(entries);
      } catch (e) {}

      return new TxSignatureRequestDto(
        tx,
        network,
        signingPublicKeyHex,
        csprRate,
        this._accountInfoRepository.accountsInfoMapCache,
        contractPackage,
        rpcAccountsInfo,
      );
    } catch (e) {
      if (isError(e)) {
        if (e.message.includes('Serialization error') || e instanceof TransactionError) {
          throw new InvalidTransactionJsonError();
        }
      }

      this._processError(e, 'invalidSignatureRequest');
    }
  }

  private async _processContractPackage(
    tx: Transaction,
    network: CasperNetwork,
    withProxyHeader = true,
  ) {
    try {
      if (tx.entryPoint.type === TransactionEntryPointEnum.Custom) {
        return this._processContractPackageFromStoredTarget(tx, network, withProxyHeader);
      } else if (tx.entryPoint.type === TransactionEntryPointEnum.Call) {
        return this._processContractPackageFromWasmProxy(tx, network, withProxyHeader);
      }

      return null;
    } catch {
      return null;
    }
  }

  private async _processContractPackageFromWasmProxy(
    tx: Transaction,
    network: CasperNetwork,
    withProxyHeader = true,
  ) {
    try {
      if (!checkIsWasmProxyTx(tx)) {
        return null;
      }

      const contractPackageHash = getWasmProxyContractPackageHash(tx.args)?.toString();

      if (!contractPackageHash) {
        return null;
      }

      return this._getContractPackage(contractPackageHash, network, withProxyHeader);
    } catch {
      return null;
    }
  }

  private async _processContractPackageFromStoredTarget(
    tx: Transaction,
    network: CasperNetwork,
    withProxyHeader = true,
  ) {
    try {
      const contractPackageHash = tx.target.stored?.id?.byPackageHash?.addr?.toHex?.() ?? null;

      if (contractPackageHash) {
        return this._getContractPackage(contractPackageHash, network, withProxyHeader);
      }

      const contractHash = tx.target.stored?.id?.byHash?.toHex?.() ?? null;

      if (!contractHash) {
        return null;
      }

      const handler = new HttpHandler(GrpcUrl[network], 'fetch');

      if (withProxyHeader) {
        handler.setReferrer(CSPR_API_PROXY_HEADERS.Referer);
      }

      const rpcClient = new RpcClient(handler);

      const contractKey = `hash-${contractHash}`;
      const result = await rpcClient.getStateItem(null, contractKey, []);
      const contract = result.storedValue.contract;
      const recoveredContractPackageHash = contract?.contractPackageHash?.hash?.toHex?.() ?? null;

      if (recoveredContractPackageHash) {
        return this._getContractPackage(recoveredContractPackageHash, network, withProxyHeader);
      }

      return null;
    } catch {
      return null;
    }
  }

  private async _getContractPackage(
    contractPackageHash: string,
    network: CasperNetwork,
    withProxyHeader: boolean,
  ) {
    const resp = await this._httpProvider.get<DataResponse<IContractPackageCloudResponse>>({
      url: `${CasperWalletApiUrl[network]}/contract-packages/${contractPackageHash}`,
      baseURL: '',
      errorType: 'getContractPackageRequest',
      ...(withProxyHeader ? { headers: CSPR_API_PROXY_HEADERS } : {}),
    });

    return resp?.data ?? null;
  }

  private _processError(e: unknown, type: TxSignatureRequestErrorType): never {
    if (isTxSignatureRequestError(e)) {
      throw e;
    }

    throw new TxSignatureRequestError(e, type);
  }
}
