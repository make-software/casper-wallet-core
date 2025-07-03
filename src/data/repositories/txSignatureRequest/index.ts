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
  Conversions,
} from 'casper-js-sdk';
import { IContractPackageCloudResponse, IOdraWasmProxyCloud } from './types';
import { getCasperNetworkByChainName } from '../../../utils';
import {
  checkIsWasmProxyTx,
  getAccountHashesFromTxSignatureRequest,
  getWasmProxyContractPackageHash,
  TxSignatureRequestDto,
} from '../../dto';
import { blake2b } from '@noble/hashes/blake2';

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
        return new TxSignatureRequestDto({
          tx,
          network,
          signingPublicKeyHex,
          csprFiatRate: '0',
          accountInfoMap: {},
          contractPackage: null,
          isWasmProxyOnApi: null,
          rpcAccountInfo: null,
        });
      }

      let csprFiatRate = '0';
      let contractPackage: IContractPackageCloudResponse | null = null;
      let rpcSenderAccountInfo: StateGetAccountInfo | null = null;
      let isWasmProxyOnApi = false;

      try {
        const rateResp = await this._tokensRepository.getCsprFiatCurrencyRate({
          network,
          withProxyHeader,
        });
        csprFiatRate = rateResp.rate.toString();
      } catch (e) {}

      try {
        isWasmProxyOnApi = await this._checkIsWasmProxyTx(tx, network, withProxyHeader);
      } catch (e) {}

      try {
        contractPackage = await this._processContractPackage(
          tx,
          network,
          isWasmProxyOnApi,
          withProxyHeader,
        );
      } catch (e) {}

      const rawSignatureRequest = new TxSignatureRequestDto({
        tx,
        network,
        csprFiatRate,
        signingPublicKeyHex,
        accountInfoMap: {},
        contractPackage,
        isWasmProxyOnApi,
        rpcAccountInfo: null,
      });

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

        rpcSenderAccountInfo = await rpcClient.getAccountInfo(
          null,
          new AccountIdentifier(undefined, tx.initiatorAddr.publicKey),
        );
      } catch (e) {}

      return new TxSignatureRequestDto({
        tx,
        network,
        signingPublicKeyHex,
        csprFiatRate,
        accountInfoMap: this._accountInfoRepository.accountsInfoMapCache,
        contractPackage,
        rpcAccountInfo: rpcSenderAccountInfo,
        isWasmProxyOnApi,
      });
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
    isWasmProxyOnApi: boolean,
    withProxyHeader = true,
  ) {
    try {
      if (tx.entryPoint.type === TransactionEntryPointEnum.Custom) {
        return this._processContractPackageFromStoredTarget(tx, network, withProxyHeader);
      } else if (tx.entryPoint.type === TransactionEntryPointEnum.Call) {
        return this._processContractPackageFromWasmProxy(
          tx,
          network,
          isWasmProxyOnApi,
          withProxyHeader,
        );
      }

      return null;
    } catch {
      return null;
    }
  }

  private async _processContractPackageFromWasmProxy(
    tx: Transaction,
    network: CasperNetwork,
    isWasmProxyOnApi: boolean,
    withProxyHeader = true,
  ) {
    try {
      if (!checkIsWasmProxyTx(tx, isWasmProxyOnApi)) {
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

  private async _checkIsWasmProxyTx(
    tx: Transaction,
    network: CasperNetwork,
    withProxyHeader = true,
  ): Promise<boolean> {
    try {
      if (!tx.target.session?.moduleBytes) {
        return false;
      }

      const blake2bHash = Conversions.encodeBase16(
        blake2b(tx.target.session.moduleBytes, { dkLen: 32 }),
      );

      await this._httpProvider.get<DataResponse<IOdraWasmProxyCloud>>({
        url: `${CasperWalletApiUrl[network]}/odra-wasm-proxies/${blake2bHash}`,
        baseURL: '',
        errorType: 'checkWasmProxyRequest',
        ...(withProxyHeader ? { headers: CSPR_API_PROXY_HEADERS } : {}),
      });

      return true;
    } catch (e) {
      return false;
    }
  }

  private _processError(e: unknown, type: TxSignatureRequestErrorType): never {
    if (isTxSignatureRequestError(e)) {
      throw e;
    }

    throw new TxSignatureRequestError(e, type);
  }
}
