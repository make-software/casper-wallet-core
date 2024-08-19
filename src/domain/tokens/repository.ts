import { ICsprBalance, IToken, ITokenFiatRate } from './entities';
import { CasperNetwork } from '../common';

export interface ITokensRepository {
  getTokens(params: IGetTokensParams): Promise<IToken[]>;
  getCsprToken(params: IGetCsprBalanceParams): Promise<IToken>;
  getCsprBalance(params: IGetCsprBalanceParams): Promise<ICsprBalance>;
  getCsprFiatCurrencyRate(params: IGetCsprFiatCurrencyRateParams): Promise<ITokenFiatRate>;
}

export interface IGetTokensParams {
  publicKey: string;
  network: CasperNetwork;
}

export interface IGetCsprBalanceParams {
  publicKey: string;
  network: CasperNetwork;
}

export interface IGetCsprFiatCurrencyRateParams {
  network: CasperNetwork;
}
