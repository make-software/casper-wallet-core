import {
  CasperWalletApiUrl,
  CloudPaginatedResponse,
  CSPR_API_PROXY_HEADERS,
  DataResponse,
  DEFAULT_PAGE_LIMIT,
  EMPTY_PAGINATED_RESPONSE,
  GrpcUrl,
  IGetGetCurrentEraIdParams,
  IGetValidatorsParams,
  IGetValidatorsWithStakesParams,
  isValidatorsError,
  IValidator,
  IValidatorsRepository,
  Network,
  ValidatorsError,
} from '../../../domain';
import type { IHttpDataProvider } from '../../../domain';
import { ValidatorDto, ValidatorWithStateDto } from '../../dto';
import { IApiValidator, IApiValidatorWithStake, IAuctionMetricsResponse } from './types';
import { HttpHandler, RpcClient, ValidatorBid } from 'casper-js-sdk';
import { isNotEmpty } from '../../../utils';

export * from './types';

export class ValidatorsRepository implements IValidatorsRepository {
  constructor(private _httpProvider: IHttpDataProvider) {}

  async getValidators({
    network,
    withProxyHeader = true,
    page,
    limit = DEFAULT_PAGE_LIMIT * 3,
  }: IGetValidatorsParams) {
    try {
      const eraId = await this.getCurrentEraId({ network, withProxyHeader });

      const resp = await this._httpProvider.get<CloudPaginatedResponse<IApiValidator>>({
        url: `${CasperWalletApiUrl[network]}/validators`,
        params: {
          page,
          page_size: limit,
          era_id: eraId,
          includes: 'account_info,average_performance',
          is_active: true,
        },
        ...(withProxyHeader ? { headers: CSPR_API_PROXY_HEADERS } : {}),
        errorType: 'getValidators',
      });

      if (!resp) {
        return EMPTY_PAGINATED_RESPONSE;
      }

      const validatorBidsMap = await this._getValidatorBids(network);

      return {
        itemCount: resp.item_count,
        pageCount: resp.page_count,
        pages: resp.pages,
        data: resp.data.map(apiValidator => new ValidatorDto(apiValidator, validatorBidsMap)),
      };
    } catch (e) {
      this._processError(e, 'getValidators');
    }
  }

  async getValidatorsWithStakes({
    network,
    publicKey,
    withProxyHeader = true,
  }: IGetValidatorsWithStakesParams): Promise<IValidator[]> {
    try {
      const eraId = await this.getCurrentEraId({ network, withProxyHeader });

      const validatorsList = await this._httpProvider.get<DataResponse<IApiValidatorWithStake[]>>({
        url: `${CasperWalletApiUrl[network]}/accounts/${publicKey}/delegations`,
        params: {
          page: 1,
          page_size: 100, // TODO Pagination?
          era_id: eraId,
          includes: 'account_info,validator_account_info,bidder',
        },
        ...(withProxyHeader ? { headers: CSPR_API_PROXY_HEADERS } : {}),
        errorType: 'getValidatorsWithStakes',
      });

      const validatorBidsMap = await this._getValidatorBids(network);

      return (validatorsList?.data ?? []).map(apiValidator => {
        return new ValidatorWithStateDto(apiValidator, validatorBidsMap);
      });
    } catch (e) {
      this._processError(e, 'getValidatorsWithStakes');
    }
  }

  async getCurrentEraId({ withProxyHeader, network }: IGetGetCurrentEraIdParams): Promise<number> {
    try {
      const resp = await this._httpProvider.get<DataResponse<IAuctionMetricsResponse>>({
        url: `${CasperWalletApiUrl[network]}/auction-metrics`,
        ...(withProxyHeader ? { headers: CSPR_API_PROXY_HEADERS } : {}),
        errorType: 'getCurrentEraId',
      });

      if (!resp?.data?.current_era_id) {
        throw new ValidatorsError(new Error('Missing current_era_id value'), 'getCurrentEraId');
      }

      return resp.data.current_era_id;
    } catch (e) {
      this._processError(e, 'getCurrentEraId');
    }
  }

  private async _getValidatorBids(network: Network): Promise<Record<string, ValidatorBid>> {
    const handler = new HttpHandler(GrpcUrl[network], 'fetch');
    handler.setCustomHeaders(CSPR_API_PROXY_HEADERS);
    const rpcClient = new RpcClient(handler);

    const auctionInfo = await rpcClient.getLatestAuctionInfo();

    return auctionInfo.auctionState.bids
      .map(bid => bid.bid.validator)
      .filter(isNotEmpty<ValidatorBid>)
      .reduce<Record<string, ValidatorBid>>(
        (acc, validator) => ({
          ...acc,
          [validator.validatorPublicKey.toHex()]: validator,
        }),
        {},
      );
  }

  private _processError(e: unknown, type: keyof IValidatorsRepository): never {
    if (isValidatorsError(e)) {
      throw e;
    }

    throw new ValidatorsError(e, type);
  }
}
