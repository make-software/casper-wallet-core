import { IOnRampProvider } from '../../../domain';

export interface IGetOnRampResponse {
  countries: IResponseCountry[];
  defaultCountry: string;
  currencies: IOnRampCurrencyItemResponse[];
  defaultCurrency: string;
  defaultAmount: string;
}

export interface IOnRampCurrencyItemResponse {
  id: number;
  code: string;
  type_id: string;
  rate: number;
}

export interface IResponseCountry {
  name: string;
  code: string;
}

export interface IOnRampProvidersResponse {
  availableProviders: IOnRampProvider[];
  currencies: IOnRampCurrencyItemResponse[];
  fiatAmount: number;
  fiatCurrency: string;
  cryptoAmount: number;
  cryptoCurrency: string;
  isCryptoChanged: boolean;
}
