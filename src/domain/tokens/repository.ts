import { ICsprBalance, IToken, ITokenFiatRate, ITokenWithFiatBalance } from './entities';
import { CasperNetwork } from '../common';

export interface ITokensRepository {
  getTokens(params: IGetTokensParams): Promise<ITokenWithFiatBalance[]>;
  getCsprToken(params: IGetCsprBalanceParams): Promise<IToken>;
  getCsprBalance(params: IGetCsprBalanceParams): Promise<ICsprBalance>;
  getCsprFiatCurrencyRate(params: IGetCsprFiatCurrencyRateParams): Promise<ITokenFiatRate>;
}

export interface IGetTokensParams {
  publicKey: string;
  network: CasperNetwork;
  withProxyHeader?: boolean;
  /** Restricts the response to these contract packages; omit for every token the account holds. */
  contractPackageHashes?: string[];
}

export interface IGetCsprBalanceParams {
  publicKey: string;
  network: CasperNetwork;
  withProxyHeader?: boolean;
}

export interface IGetCsprFiatCurrencyRateParams {
  network: CasperNetwork;
  withProxyHeader?: boolean;
}
