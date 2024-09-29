import { IEntity, Network, SupportedFiatCurrencies } from '../common';
import { Maybe } from '../../typings';

export interface IToken extends IEntity {
  readonly contractPackageHash: string;
  readonly contractHash: string;

  readonly name: string;
  readonly network: Network;
  readonly symbol: string;
  readonly decimals: number;
  readonly iconUrl: Maybe<string> | 'CSPR';

  readonly balance: string;
  readonly decimalBalance: string;
  readonly formattedDecimalBalance: string;

  // is CSPR - for Casper Network
  readonly isNative: boolean;
}

export interface ITokenWithFiatBalance extends IToken {
  fiatBalance: string;
  formattedFiatBalance: string;
}

export interface ICsprBalance {
  readonly publicKey: string;
  readonly accountHash: string;

  readonly totalBalance: string;
  readonly totalDecimalBalance: string;
  readonly totalFormattedDecimalBalance: string;

  readonly liquidBalance: string;
  readonly liquidDecimalBalance: string;
  readonly liquidFormattedDecimalBalance: string;

  readonly delegatedBalance: string;
  readonly delegatedDecimalBalance: string;
  readonly delegatedFormattedDecimalBalance: string;

  readonly undelegatingBalance: string;
  readonly undelegatingDecimalBalance: string;
  readonly undelegatingFormattedDecimalBalance: string;
}

export interface ITokenFiatRate {
  readonly rate: number;
  readonly currency: SupportedFiatCurrencies;
}
