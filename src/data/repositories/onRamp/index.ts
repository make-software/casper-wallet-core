import {
  IGetOnRampProvidersData,
  IOnRampOptions,
  IOnRampProvidersOptions,
  IOnRampRepository,
  IProviderLocation,
  IProviderSelectionData,
  isOnRampError,
  OnRampApiUrl,
  OnRampError,
} from '../../../domain';
import type { IHttpDataProvider } from '../../../domain';
import { OnRampDto, OnRampProvidersDto } from '../../dto';
import { IGetOnRampResponse, IOnRampProvidersResponse } from './types';

export * from './types';

export class OnRampRepository implements IOnRampRepository {
  constructor(private _httpProvider: IHttpDataProvider) {}

  async getOnRampCountriesAndCurrencies(): Promise<IOnRampOptions> {
    try {
      const response = await this._httpProvider.get<IGetOnRampResponse>({
        url: `${OnRampApiUrl}/options`,
        errorType: 'getOnRampCountriesAndCurrencies',
      });

      return new OnRampDto(response);
    } catch (e) {
      this._processError(e, 'getOnRampCountriesAndCurrencies');
    }
  }

  getOnRampProviders = async (data: IGetOnRampProvidersData): Promise<IOnRampProvidersOptions> => {
    try {
      const response = await this._httpProvider.post<IOnRampProvidersResponse>({
        url: `${OnRampApiUrl}/options`,
        errorType: 'getOnRampProviders',
        data: data,
      });

      return new OnRampProvidersDto(response);
    } catch (e) {
      this._processError(e, 'getOnRampProviders');
    }
  };

  getProviderLocation = async (data: IProviderSelectionData): Promise<IProviderLocation> => {
    try {
      const response = await this._httpProvider.post<IProviderLocation>({
        url: `${OnRampApiUrl}/selection`,
        errorType: 'getProviderLocation',
        data: data,
      });

      if (!response) {
        return { location: '', provider: '' };
      }

      return response;
    } catch (e) {
      this._processError(e, 'getProviderLocation');
    }
  };

  private _processError(e: unknown, type: keyof IOnRampRepository): never {
    if (isOnRampError(e)) {
      throw e;
    }

    throw new OnRampError(e, type);
  }
}
