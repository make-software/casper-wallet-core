import {
  DeploysError,
  isDeploysError,
  EMPTY_PAGINATED_RESPONSE,
  DEFAULT_PAGE_LIMIT,
  HttpClientNotFoundError,
  CSPR_API_PROXY_HEADERS,
  EMPTY_CLOUD_PAGINATED_RESPONSE,
  CasperWalletApiUrl,
  IDeploysRepository,
  IGetDeploysParams,
  CloudPaginatedResponse,
  PaginatedResponse,
  IGetSingleDeployParams,
  DataResponse,
  IDeploy,
  CasperApiUrl,
} from '../../../domain';
import type { IHttpDataProvider, IAccountInfoRepository } from '../../../domain';
import { getAccountHashFromPublicKey } from '../../../utils';
import { CsprTransferDeployDto, processDeploy, Cep18TransferDeployDto } from '../../dto';
import { ExtendedCloudDeploy } from './types';
import {
  getAccountHashesFromDeploy,
  getAccountHashesFromDeployActionResults,
} from '../../dto/deploys/common';
import { ICsprTransferResponse, IErc20TokensTransferResponse } from './old-types';

export * from './types';
export * from './old-types';

export class DeploysRepository implements IDeploysRepository {
  constructor(
    private _httpProvider: IHttpDataProvider,
    private _accountInfoRepository: IAccountInfoRepository,
  ) {}

  async getDeploys({
    network,
    activePublicKey,
    page,
    limit = DEFAULT_PAGE_LIMIT,
    contractPackageHash,
  }: IGetDeploysParams) {
    try {
      const resp = await this._httpProvider.get<CloudPaginatedResponse<ExtendedCloudDeploy>>({
        url: `${CasperWalletApiUrl[network]}/accounts/${activePublicKey}/deploys`,
        params: {
          public_key: activePublicKey,
          page,
          page_size: limit,
          includes: 'rate(1),contract_entrypoint,contract_package,transfers,account_info',
          ...(contractPackageHash ? { contract_package_hash: contractPackageHash } : {}),
        },
        headers: CSPR_API_PROXY_HEADERS,
        errorType: 'getDeploys',
      });

      if (!resp) {
        return EMPTY_CLOUD_PAGINATED_RESPONSE;
      }

      const rawDeploys = resp.data.map(d => processDeploy(activePublicKey, network, {}, d));
      const accountHashes = rawDeploys.map(d => getAccountHashesFromDeploy(d)).flat();

      await this._accountInfoRepository.getAccountsInfo({
        network,
        accountHashes,
      });

      return {
        ...resp,
        data: resp.data.map(d =>
          processDeploy(
            activePublicKey,
            network,
            this._accountInfoRepository.accountsInfoMapCache,
            d,
          ),
        ),
      };
    } catch (e) {
      this._processError(e, 'getDeploys');
    }
  }

  async getCsprTransferDeploys({
    network,
    activePublicKey,
    page,
    limit = DEFAULT_PAGE_LIMIT,
  }: IGetDeploysParams) {
    try {
      const accountHash = getAccountHashFromPublicKey(activePublicKey);

      const resp = await this._httpProvider.get<PaginatedResponse<ICsprTransferResponse>>({
        url: `${CasperApiUrl[network]}/accounts/${accountHash}/transfers`,
        params: {
          page,
          limit,
          with_extended_info: 1,
          with_amounts_in_currency_id: 1,
        },
        errorType: 'getCsprTransferDeploys',
      });

      if (!resp) {
        return EMPTY_PAGINATED_RESPONSE;
      }

      const rawDeploys = resp.data.map(d => new CsprTransferDeployDto(activePublicKey, d));
      const accountHashes = rawDeploys.map(d => getAccountHashesFromDeploy(d)).flat();

      await this._accountInfoRepository.getAccountsInfo({
        network,
        accountHashes,
      });

      return {
        ...resp,
        data: resp.data.map(
          d =>
            new CsprTransferDeployDto(
              activePublicKey,
              d,
              this._accountInfoRepository.accountsInfoMapCache,
            ),
        ),
      };
    } catch (e) {
      this._processError(e, 'getCsprTransferDeploys');
    }
  }

  async getSingleDeploy({ deployHash, network, activePublicKey }: IGetSingleDeployParams) {
    try {
      const resp = await this._httpProvider.get<DataResponse<ExtendedCloudDeploy>>({
        url: `${CasperWalletApiUrl[network]}/deploys/${deployHash}`,
        params: {
          includes:
            'rate(1),contract,contract_package,contract_entrypoint,account_info,transfers,nft_token_actions,ft_token_actions',
        },
        headers: CSPR_API_PROXY_HEADERS,
        errorType: 'getSingleDeploy',
      });

      const rawDeploy = processDeploy(activePublicKey, network, {}, resp?.data);
      const deployHashes = getAccountHashesFromDeploy(rawDeploy);
      const resultsHashes = getAccountHashesFromDeployActionResults(rawDeploy);

      await this._accountInfoRepository.getAccountsInfo({
        network,
        accountHashes: [...deployHashes, ...resultsHashes],
      });

      return processDeploy(
        activePublicKey,
        network,
        this._accountInfoRepository.accountsInfoMapCache,
        resp?.data,
      );
    } catch (e) {
      if (e instanceof HttpClientNotFoundError) {
        // A common case when an api has not yet received information from the block
        return null;
      } else {
        this._processError(e, 'getSingleDeploy');
      }
    }
  }

  async getCep18TransferDeploys({
    network,
    page,
    limit = DEFAULT_PAGE_LIMIT,
    activePublicKey,
    contractPackageHash,
  }: IGetDeploysParams): Promise<PaginatedResponse<IDeploy>> {
    try {
      const accountHash = getAccountHashFromPublicKey(activePublicKey);

      const resp = await this._httpProvider.get<PaginatedResponse<IErc20TokensTransferResponse>>({
        url: `${CasperApiUrl[network]}/erc20-token-actions`,
        params: {
          contract_package_hash: contractPackageHash,
          account_hash: accountHash,
          page,
          limit,
          fields: 'contract_package,deploy',
          with_amounts_in_currency_id: 1,
        },
        errorType: 'getCep18TransferDeploys',
      });

      if (!resp) {
        return EMPTY_PAGINATED_RESPONSE;
      }

      const rawDeploys = resp.data.map(d => new Cep18TransferDeployDto(activePublicKey, d));
      const accountHashes = rawDeploys.map(d => getAccountHashesFromDeploy(d)).flat();

      await this._accountInfoRepository.getAccountsInfo({
        network,
        accountHashes,
      });

      return {
        ...resp,
        data: resp.data.map(
          d =>
            new Cep18TransferDeployDto(
              activePublicKey,
              d,
              this._accountInfoRepository.accountsInfoMapCache,
            ),
        ),
      };
    } catch (e) {
      this._processError(e, 'getCep18TransferDeploys');
    }
  }

  private _processError(e: unknown, type: keyof IDeploysRepository): never {
    if (isDeploysError(e)) {
      throw e;
    }

    throw new DeploysError(e, type);
  }
}
