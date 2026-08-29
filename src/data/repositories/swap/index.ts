import {
  CasperNetwork,
  CloudPaginatedResponse,
  CSPR_NATIVE_TOKEN_ID,
  DataResponse,
  IAccountTokenOwnershipItem,
  IDexToken,
  IGetAccountTokenOwnershipParams,
  IGetCsprFiatRateParams,
  IGetDexTokenParams,
  IGetDexTokensParams,
  IGetSwapQuoteParams,
  IGetSwapsHistoryParams,
  IGetTokenFiatRateParams,
  isSwapError,
  ISwapHistoryEntry,
  ISwapQuote,
  ISwapRepository,
  PaginatedResponse,
  SwapError,
  SwapErrorType,
  ZERO_HASH,
} from '../../../domain';
import type { IHttpDataProvider } from '../../../domain';
import { DexTokenDto, SwapQuoteDto } from '../../dto/swap';
import {
  CsprFiatRateApiResponse,
  DexTokenApiResponse,
  RawSwapQuote,
  TokenFiatRateApiResponse,
} from './types';

export * from './types';

// These requests go straight to the trade API rather than through the Casper Wallet cloud API,
// so CSPR_API_PROXY_HEADERS do not apply.
export class SwapRepository implements ISwapRepository {
  constructor(
    private _httpProvider: IHttpDataProvider,
    private _tradeApiUrl: Record<CasperNetwork, string>,
    private _wrappedCsprContractPackageHash: Record<CasperNetwork, string>,
  ) {}

  async getQuote(params: IGetSwapQuoteParams): Promise<ISwapQuote> {
    const { network, tokenIn, tokenOut, amount, typeId } = params;

    try {
      const baseUrl = this._resolveBaseUrl(network, 'getQuote');

      const resp = await this._httpProvider.get<DataResponse<RawSwapQuote>>({
        url: `${baseUrl}/quote`,
        params: {
          token_in: tokenIn.id === CSPR_NATIVE_TOKEN_ID ? ZERO_HASH : tokenIn.packageHash,
          token_out: tokenOut.id === CSPR_NATIVE_TOKEN_ID ? ZERO_HASH : tokenOut.packageHash,
          amount,
          type_id: typeId,
        },
        errorType: 'getQuote',
      });

      return new SwapQuoteDto(resp!.data, tokenIn, tokenOut, typeId);
    } catch (e) {
      this._processError(e, 'getQuote');
    }
  }

  async getDexTokens(params: IGetDexTokensParams): Promise<IDexToken[]> {
    const { network, currencyId } = params;

    try {
      const baseUrl = this._resolveBaseUrl(network, 'getDexTokens');

      const resp = await this._httpProvider.get<DataResponse<DexTokenApiResponse[]>>({
        url: `${baseUrl}/tokens?includes=token_market_data(${currencyId}),total_value_locked`,
        params: {
          is_whitelisted: true,
          is_blacklisted: false,
        },
        errorType: 'getDexTokens',
      });

      return (resp?.data ?? []).map(
        token => new DexTokenDto(token, this._wrappedCsprContractPackageHash[network]),
      );
    } catch (e) {
      this._processError(e, 'getDexTokens');
    }
  }

  async getDexToken(params: IGetDexTokenParams): Promise<IDexToken> {
    const { network, contractPackageHash, currencyId } = params;

    try {
      const baseUrl = this._resolveBaseUrl(network, 'getDexToken');

      const resp = await this._httpProvider.get<DataResponse<DexTokenApiResponse>>({
        url: `${baseUrl}/tokens/${contractPackageHash}?includes=token_market_data(${currencyId}),total_value_locked`,
        errorType: 'getDexToken',
      });

      return new DexTokenDto(resp!.data, this._wrappedCsprContractPackageHash[network]);
    } catch (e) {
      this._processError(e, 'getDexToken');
    }
  }

  async getAccountTokenOwnership(
    params: IGetAccountTokenOwnershipParams,
  ): Promise<IAccountTokenOwnershipItem[]> {
    const { network, publicKey, contractPackageHashes } = params;

    try {
      const baseUrl = this._resolveBaseUrl(network, 'getAccountTokenOwnership');

      const queryParams: Record<string, number | string> = {
        page: 1,
        page_size: 250,
        includes: 'contract_package',
      };

      if (contractPackageHashes && contractPackageHashes.length > 0) {
        queryParams.contract_package_hash = contractPackageHashes.join(',');
      }

      const resp = await this._httpProvider.get<DataResponse<IAccountTokenOwnershipItem[]>>({
        url: `${baseUrl}/accounts/${publicKey}/ft-token-ownership`,
        params: queryParams,
        errorType: 'getAccountTokenOwnership',
      });

      return resp?.data ?? [];
    } catch (e) {
      this._processError(e, 'getAccountTokenOwnership');
    }
  }

  async getCsprFiatRate(params: IGetCsprFiatRateParams): Promise<number> {
    const { network, currencyId } = params;

    try {
      const baseUrl = this._resolveBaseUrl(network, 'getCsprFiatRate');

      const resp = await this._httpProvider.get<DataResponse<CsprFiatRateApiResponse>>({
        url: `${baseUrl}/rates/${currencyId}/latest`,
        errorType: 'getCsprFiatRate',
      });

      const amount = resp?.data?.amount;

      if (typeof amount !== 'number' || Number.isNaN(amount)) {
        throw new Error(`Invalid CSPR fiat rate response for network "${network}"`);
      }

      return amount;
    } catch (e) {
      this._processError(e, 'getCsprFiatRate');
    }
  }

  async getTokenFiatRate(params: IGetTokenFiatRateParams): Promise<number | null> {
    const { network, contractPackageHash, currencyId } = params;

    try {
      const baseUrl = this._resolveBaseUrl(network, 'getTokenFiatRate');

      const resp = await this._httpProvider.get<DataResponse<TokenFiatRateApiResponse>>({
        url: `${baseUrl}/ft/${contractPackageHash}/rates/latest`,
        params: { currency_id: currencyId },
        errorType: 'getTokenFiatRate',
      });

      const amount = resp?.data?.amount;

      if (amount == null) {
        return null;
      }

      const numericAmount = Number(amount);

      return Number.isNaN(numericAmount) ? null : numericAmount;
    } catch (e) {
      this._processError(e, 'getTokenFiatRate');
    }
  }

  async getSwapsHistory(
    params: IGetSwapsHistoryParams,
  ): Promise<PaginatedResponse<ISwapHistoryEntry>> {
    const {
      network,
      pagination,
      orderBy = 'timestamp',
      orderDirection = 'DESC',
      pairContractPackageHash,
      tokenContractPackageHash,
      currencyId = 1,
    } = params;

    try {
      const baseUrl = this._resolveBaseUrl(network, 'getSwapsHistory');

      const queryParams: Record<string, number | string> = {
        page: pagination?.page ?? 1,
        page_size: pagination?.pageSize ?? 250,
        order_by: orderBy,
        order_direction: orderDirection,
        includes: `ft_rate(${currencyId},1),token0_contract_package,token1_contract_package,token0,token1,transaction`,
      };

      if (pairContractPackageHash) {
        queryParams.pair_contract_package_hash = pairContractPackageHash;
      }

      if (tokenContractPackageHash) {
        queryParams.token_contract_package_hash = tokenContractPackageHash;
      }

      const resp = await this._httpProvider.get<CloudPaginatedResponse<ISwapHistoryEntry>>({
        url: `${baseUrl}/swaps`,
        params: queryParams,
        errorType: 'getSwapsHistory',
      });

      return {
        data: resp?.data ?? [],
        itemCount: resp?.item_count ?? 0,
        pageCount: resp?.page_count ?? 0,
        pages: resp?.pages ?? [],
      };
    } catch (e) {
      this._processError(e, 'getSwapsHistory');
    }
  }

  /** Throws a `SwapError` instead of silently requesting against an empty base URL. */
  private _resolveBaseUrl(network: CasperNetwork, type: SwapErrorType): string {
    const baseUrl = this._tradeApiUrl[network];

    if (!baseUrl) {
      throw new SwapError(new Error(`No trade API URL configured for network "${network}"`), type);
    }

    return baseUrl;
  }

  private _processError(e: unknown, type: SwapErrorType): never {
    if (isSwapError(e)) {
      throw e;
    }

    throw new SwapError(e, type);
  }
}
