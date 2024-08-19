import { IOnRampCurrencyItem, IOnRampProvider } from '../../../domain';

export interface IGetOnRampResponse {
  countries: IResponseCountry[];
  defaultCountry: string;
  currencies: IOnRampCurrencyItem[];
  defaultCurrency: string;
  defaultAmount: string;
}

export interface IResponseCountry {
  name: string;
  code: string;
}

export interface IOnRampProvidersResponse {
  availableProviders: IOnRampProvider[];
  currencies: IOnRampCurrencyItem[];
  fiatAmount: number;
  fiatCurrency: string;
  cryptoAmount: number;
  cryptoCurrency: string;
  isCryptoChanged: boolean;
}
