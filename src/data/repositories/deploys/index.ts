import {
  DeploysError,
  isDeploysError,
  DEFAULT_PAGE_LIMIT,
  HttpClientNotFoundError,
  CSPR_API_PROXY_HEADERS,
  EMPTY_PAGINATED_RESPONSE,
  CasperWalletApiUrl,
  IDeploysRepository,
  IGetDeploysParams,
  CloudPaginatedResponse,
  IGetSingleDeployParams,
  DataResponse,
  IDeploy,
  PaginatedResponse,
} from '../../../domain';
import type { IHttpDataProvider, IAccountInfoRepository } from '../../../domain';
import { getAccountHashFromPublicKey } from '../../../utils';
import { CsprTransferDeployDto, processDeploy, Cep18TransferDeployDto } from '../../dto';
import { ExtendedCloudDeploy, ICsprTransferResponse, IErc20TokensTransferResponse } from './types';
import {
  getAccountHashesFromDeploy,
  getAccountHashesFromDeployActionResults,
} from '../../dto/deploys/common';

export * from './types';

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
    withProxyHeader = true,
  }: IGetDeploysParams) {
    try {
      const resp = await this._httpProvider.get<CloudPaginatedResponse<ExtendedCloudDeploy>>({
        url: `${CasperWalletApiUrl[network]}/accounts/${activePublicKey}/deploys`,
        params: {
          public_key: activePublicKey,
          page,
          page_size: limit,
          includes: 'rate(1),contract_entrypoint,contract_package,transfers,account_info', // ,friendlymarket_data(1),coingecko_data(1)
          ...(contractPackageHash ? { contract_package_hash: contractPackageHash } : {}),
        },
        ...(withProxyHeader ? { headers: CSPR_API_PROXY_HEADERS } : {}),
        errorType: 'getDeploys',
      });

      if (!resp) {
        return EMPTY_PAGINATED_RESPONSE;
      }

      const rawDeploys = resp.data.map(d => processDeploy(activePublicKey, network, {}, d));
      const accountHashes = rawDeploys.map(d => getAccountHashesFromDeploy(d)).flat();

      await this._accountInfoRepository.getAccountsInfo({
        network,
        accountHashes,
      });

      return {
        itemCount: resp.item_count,
        pageCount: resp.page_count,
        pages: resp.pages,
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
    withProxyHeader = true,
  }: IGetDeploysParams) {
    try {
      const accountHash = getAccountHashFromPublicKey(activePublicKey);

      const resp = await this._httpProvider.get<CloudPaginatedResponse<ICsprTransferResponse>>({
        url: `${CasperWalletApiUrl[network]}/accounts/${accountHash}/transfers`,
        params: {
          page,
          page_size: limit,
          includes: 'initiator_public_key,to_public_key,rate(1),deploy',
        },
        ...(withProxyHeader ? { headers: CSPR_API_PROXY_HEADERS } : {}),
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
        itemCount: resp.item_count,
        pageCount: resp.page_count,
        pages: resp.pages,
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

  async getSingleDeploy({
    deployHash,
    network,
    activePublicKey,
    withProxyHeader = true,
  }: IGetSingleDeployParams) {
    try {
      const resp = await this._httpProvider.get<DataResponse<ExtendedCloudDeploy>>({
        url: `${CasperWalletApiUrl[network]}/deploys/${deployHash}`,
        params: {
          includes:
            'rate(1),contract,contract_package,contract_entrypoint,account_info,transfers,nft_token_actions,ft_token_actions',
        },
        ...(withProxyHeader ? { headers: CSPR_API_PROXY_HEADERS } : {}),
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
    withProxyHeader = true,
  }: IGetDeploysParams): Promise<PaginatedResponse<IDeploy>> {
    try {
      const accountHash = getAccountHashFromPublicKey(activePublicKey);

      const resp = await this._httpProvider.get<
        CloudPaginatedResponse<IErc20TokensTransferResponse>
      >({
        url: `${CasperWalletApiUrl[network]}/accounts/${accountHash}/ft-token-actions`,
        params: {
          contract_package_hash: contractPackageHash, // TODO do not worked
          account_identifier: accountHash,
          page,
          page_size: limit,
          includes: 'contract_package,deploy', // ,friendlymarket_data(1),coingecko_data(1)
        },
        ...(withProxyHeader ? { headers: CSPR_API_PROXY_HEADERS } : {}),
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
        itemCount: resp.item_count,
        pageCount: resp.page_count,
        pages: resp.pages,
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
