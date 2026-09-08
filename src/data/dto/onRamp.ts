import {
  IOnRampCountry,
  IOnRampCurrencyItem,
  IOnRampOptions,
  IOnRampProvider,
  IOnRampProvidersOptions,
} from '../../domain';
import type {
  IGetOnRampResponse,
  IOnRampCurrencyItemResponse,
  IOnRampProvidersResponse,
  IResponseCountry,
} from '../repositories';
import { Maybe } from '../../typings';

export class OnRampDto implements IOnRampOptions {
  constructor(response?: IGetOnRampResponse) {
    this.countries = mapCountriesWithFlags(response?.countries);
    this.defaultAmount = response?.defaultAmount ?? '';
    this.defaultCountry = response?.defaultCountry ?? '';
    this.currencies = mapCurrencies(response?.currencies);
    this.defaultCurrency = response?.defaultCurrency ?? '';
  }

  readonly countries: IOnRampCountry[];
  readonly defaultCountry: string;
  readonly currencies: IOnRampCurrencyItem[];
  readonly defaultCurrency: string;
  readonly defaultAmount: string;
}

export class OnRampProvidersDto implements IOnRampProvidersOptions {
  constructor(response?: IOnRampProvidersResponse) {
    this.fiatAmount = response?.fiatAmount ?? 0;
    this.cryptoAmount = response?.cryptoAmount ?? 0;
    this.currency = mapCurrencies(response?.currencies)[0] ?? null;
    this.availableProviders = response?.availableProviders ?? [];
    this.isCryptoChanged = response?.isCryptoChanged ?? false;
    this.cryptoCurrency = response?.cryptoCurrency ?? '';
  }

  readonly fiatAmount: number;
  readonly cryptoAmount: number;
  readonly currency: Maybe<IOnRampCurrencyItem>;
  readonly availableProviders: IOnRampProvider[];
  readonly isCryptoChanged: boolean;
  readonly cryptoCurrency: string;
}

const mapCurrencies = (currencies?: IOnRampCurrencyItemResponse[]): IOnRampCurrencyItem[] =>
  (currencies ?? []).map(({ id, code, type_id, rate }) => ({ id, code, typeId: type_id, rate }));

// TODO fix it
export const mapCountriesWithFlags = (countries?: IResponseCountry[]): IOnRampCountry[] => {
  if (!countries) {
    return [];
  }

  return countries?.map(country => ({
    ...country,
    flagUri: `https://cdn.jsdelivr.net/gh/lipis/flag-icons/flags/4x3/${country?.code?.toLowerCase()}.svg`,
  }));
};
