import {
  IGetOnRampResponse,
  IOnRampProvidersResponse,
  IResponseCountry,
} from '../../data/repositories';
import { Maybe } from '../../typings';

// TODO fix it
export interface IOnRampOptions extends Omit<IGetOnRampResponse, 'countries'> {
  countries: IOnRampCountry[];
}

export interface IOnRampCountry extends IResponseCountry {
  flagUri: string;
}

export interface IOnRampCurrencyItem {
  id: number;
  code: string;
  type_id: string;
  rate: number;
}

export interface IOnRampProvidersOptions
  extends Omit<IOnRampProvidersResponse, 'currencies' | 'isCryptoChanged' | 'fiatCurrency'> {
  currency?: Maybe<IOnRampCurrencyItem>;
}

export interface IOnRampProvider {
  cryptoAmount: string;
  cryptoCurrency: string;
  fiatAmount: string;
  fiatCurrency: string;
  csprExchangeRate: string;
  fees: string;
  logoPNG: string;
  logoSVG?: string;
  providerKey: string;
  providerName: string;
}

export interface IProviderSelectionData {
  account: string;
  cryptoAsset: string;
  selectedOnrampProvider: string;
  cryptoAmount: Maybe<number>;
  fiatAmount: Maybe<number>;
  fiatCurrency: string;
}

export interface IProviderLocation {
  location: string;
  provider: string;
}
