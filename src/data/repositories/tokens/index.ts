import {
  CSPR_COIN,
  CasperApiUrl,
  isTokensError,
  TokensError,
  HttpClientNotFoundError,
  CSPR_API_PROXY_HEADERS,
  CasperWalletApiUrl,
  ITokensRepository,
  DataResponse,
  IGetTokensParams,
  IGetCsprBalanceParams,
  IToken,
  IGetCsprFiatCurrencyRateParams,
} from '../../../domain';
import type { IHttpDataProvider } from '../../../domain';
import { CsprBalanceDto, TokenDto, TokenFiatRateDto } from '../../dto';
import { getAccountHashFromPublicKey } from '../../../utils';
import { Erc20Token, IGetCsprBalanceResponse, IGetCurrencyRateResponse } from './types';

export * from './types';

export class TokensRepository implements ITokensRepository {
  constructor(private _httpProvider: IHttpDataProvider) {}

  async getTokens({ network, publicKey }: IGetTokensParams) {
    try {
      const accountHash = getAccountHashFromPublicKey(publicKey);

      const tokensList = await this._httpProvider.get<DataResponse<Erc20Token[]>>({
        url: `${CasperApiUrl[network]}/accounts/${accountHash}/erc20-tokens`,
        params: {
          fields: 'latest_contract,contract_package',
        },
        errorType: 'getTokens',
      });

      return (tokensList?.data ?? []).map(token => {
        return new TokenDto(network, {
          ...(token.contract_package ?? {}),
          balance: token.balance,
          contractHash: token.latest_contract?.contract_hash,
        });
      });
    } catch (e) {
      this._processError(e, 'getTokens');
    }
  }

  async getCsprBalance({ publicKey, network }: IGetCsprBalanceParams) {
    try {
      const resp = await this._httpProvider.get<DataResponse<IGetCsprBalanceResponse>>({
        url: `${CasperWalletApiUrl[network]}/accounts/${publicKey}`,
        errorType: 'getCsprBalance',
        params: {
          includes: 'delegated_balance,undelegating_balance',
        },
        headers: CSPR_API_PROXY_HEADERS,
      });

      return new CsprBalanceDto(resp?.data);
    } catch (e) {
      if (e instanceof HttpClientNotFoundError) {
        return new CsprBalanceDto({ balance: 0 });
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

  async getCsprFiatCurrencyRate({ network }: IGetCsprFiatCurrencyRateParams) {
    try {
      const resp = await this._httpProvider.get<IGetCurrencyRateResponse>({
        url: `${CasperApiUrl[network]}/rates/1/amount`,
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
