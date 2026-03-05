import {
  CSPR_COIN,
  isTokensError,
  TokensError,
  HttpClientNotFoundError,
  CSPR_API_PROXY_HEADERS,
  ITokensRepository,
  DataResponse,
  IGetTokensParams,
  IGetCsprBalanceParams,
  IToken,
  IGetCsprFiatCurrencyRateParams,
  ITokenWithFiatBalance,
  CasperNetwork,
} from '../../../domain';
import type { IHttpDataProvider } from '../../../domain';
import { CsprBalanceDto, TokenDto, TokenFiatRateDto } from '../../dto';
import { getAccountHashFromPublicKey } from '../../../utils';
import { Erc20Token, IGetCsprBalanceResponse, IGetCurrencyRateResponse } from './types';

export * from './types';

export class TokensRepository implements ITokensRepository {
  constructor(
    private _httpProvider: IHttpDataProvider,
    private _casperWalletApiUrl: Record<CasperNetwork, string>,
  ) {}

  async getTokens({
    network,
    publicKey,
    withProxyHeader = true,
  }: IGetTokensParams): Promise<ITokenWithFiatBalance[]> {
    try {
      const accountHash = getAccountHashFromPublicKey(publicKey);

      const tokensList = await this._httpProvider.get<DataResponse<Erc20Token[]>>({
        url: `https://cspr-wallet-api.dev.make.services:443/accounts/${accountHash}/ft-token-ownership`, // TODO replace with prod API
        params: {
          page_size: 100, // TODO pagination?
          includes: 'contract_package,token_market_data(1)',
        },
        ...(withProxyHeader ? { headers: CSPR_API_PROXY_HEADERS } : {}),
        errorType: 'getTokens',
      });

      return (tokensList?.data ?? []).map(token => {
        return new TokenDto(network, {
          ...(token.contract_package ?? {}),
          balance: token.balance,
        });
      });
    } catch (e) {
      this._processError(e, 'getTokens');
    }
  }

  async getCsprBalance({ publicKey, network, withProxyHeader = true }: IGetCsprBalanceParams) {
    try {
      const resp = await this._httpProvider.get<DataResponse<IGetCsprBalanceResponse>>({
        url: `${this._casperWalletApiUrl[network]}/accounts/${publicKey}`,
        errorType: 'getCsprBalance',
        params: {
          includes: 'delegated_balance,undelegating_balance',
        },
        ...(withProxyHeader ? { headers: CSPR_API_PROXY_HEADERS } : {}),
      });

      return new CsprBalanceDto(resp?.data);
    } catch (e) {
      if (e instanceof HttpClientNotFoundError) {
        return new CsprBalanceDto({ balance: '0' });
      } else {
        this._processError(e, 'getCsprBalance');
      }
    }
  }

  async getCsprToken({ publicKey, network }: IGetCsprBalanceParams) {
    try {
      const { liquidBalance, liquidDecimalBalance, liquidFormattedDecimalBalance } =
        await this.getCsprBalance({
          publicKey,
          network,
        });

      return <IToken>{
        ...CSPR_COIN,
        id: `Cspr-${network}-${publicKey}`,
        network,
        balance: liquidBalance,
        decimalBalance: liquidDecimalBalance,
        formattedDecimalBalance: liquidFormattedDecimalBalance,
      };
    } catch (e) {
      this._processError(e, 'getCsprToken');
    }
  }

  async getCsprFiatCurrencyRate({
    network,
    withProxyHeader = true,
  }: IGetCsprFiatCurrencyRateParams) {
    try {
      const resp = await this._httpProvider.get<IGetCurrencyRateResponse>({
        url: `${this._casperWalletApiUrl[network]}/rates/1/amount`,
        ...(withProxyHeader ? { headers: CSPR_API_PROXY_HEADERS } : {}),
        errorType: 'getCsprFiatCurrencyRate',
      });

      return new TokenFiatRateDto(resp);
    } catch (e) {
      this._processError(e, 'getCsprFiatCurrencyRate');
    }
  }

  private _processError(e: unknown, type: keyof ITokensRepository): never {
    if (isTokensError(e)) {
      throw e;
    }

    throw new TokensError(e, type);
  }
}
