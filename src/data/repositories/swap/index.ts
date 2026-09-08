import {
  CasperNetwork,
  CSPR_NATIVE_TOKEN_ID,
  DataResponse,
  USD_CURRENCY_ID,
  IDexToken,
  IGetDexTokenParams,
  IGetDexTokensParams,
  IGetSwapQuoteParams,
  isSwapError,
  ISwapQuote,
  ISwapRepository,
  SwapError,
  SwapErrorType,
  ZERO_HASH,
} from '../../../domain';
import type { IHttpDataProvider } from '../../../domain';
import { DexTokenDto, SwapQuoteDto } from '../../dto/swap';
import { DexTokenApiResponse, RawSwapQuote } from './types';

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
    const { network } = params;

    try {
      const baseUrl = this._resolveBaseUrl(network, 'getDexTokens');

      const resp = await this._httpProvider.get<DataResponse<DexTokenApiResponse[]>>({
        url: `${baseUrl}/tokens?includes=token_market_data(${USD_CURRENCY_ID}),total_value_locked`,
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
    const { network, contractPackageHash } = params;

    try {
      const baseUrl = this._resolveBaseUrl(network, 'getDexToken');

      const resp = await this._httpProvider.get<DataResponse<DexTokenApiResponse>>({
        url: `${baseUrl}/tokens/${contractPackageHash}?includes=token_market_data(${USD_CURRENCY_ID}),total_value_locked`,
        errorType: 'getDexToken',
      });

      return new DexTokenDto(resp!.data, this._wrappedCsprContractPackageHash[network]);
    } catch (e) {
      this._processError(e, 'getDexToken');
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
