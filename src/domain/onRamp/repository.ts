import {
  IOnRampOptions,
  IOnRampProvidersOptions,
  IProviderLocation,
  IProviderSelectionData,
} from './entities';

export interface IOnRampRepository {
  getOnRampCountriesAndCurrencies(): Promise<IOnRampOptions>;
  getOnRampProviders(data: IGetOnRampProvidersData): Promise<IOnRampProvidersOptions>;
  getProviderLocation(data: IProviderSelectionData): Promise<IProviderLocation>;
}

export interface IGetOnRampProvidersData {
  amount: number;
  country: string;
  fiatCurrency: string;
  paymentCurrency: string;
}
