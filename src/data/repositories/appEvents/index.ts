import {
  AppEventsError,
  CasperWalletApiEndpoints,
  CSPR_API_PROXY_HEADERS,
  DataResponse,
  IAppEventsRepository,
  IAppMarketingEvent,
  IAppReleaseEvent,
  IGetMarketingEventsParams,
  IGetReleaseUpdatesParams,
  IHttpDataProvider,
} from '../../../domain';
import { IMarketingEventApiResponse, IReleaseEventApiResponse } from './types.ts';
import { AppMarketingEventDto, AppReleaseEventDto } from '../../dto';

export * from './types';

export class AppEventsRepository implements IAppEventsRepository {
  constructor(private _httpProvider: IHttpDataProvider) {}

  async getReleaseEvents({
    currentVersion,
    env = 'PRODUCTION',
    withProxyHeader = true,
  }: IGetReleaseUpdatesParams): Promise<IAppReleaseEvent[]> {
    try {
      const response = await this._httpProvider.get<DataResponse<IReleaseEventApiResponse[]>>({
        url: `${CasperWalletApiEndpoints[env]}/mobile-client-versions`,
        params: {
          after: `v${currentVersion}`,
        },
        errorType: 'getReleaseEvents',
        ...(withProxyHeader ? { headers: CSPR_API_PROXY_HEADERS } : {}),
      });

      return response?.data?.map(event => new AppReleaseEventDto(event)) ?? [];
    } catch (e) {
      throw new AppEventsError(e, 'getReleaseEvents');
    }
  }

  async getMarketingEvents({
    env = 'PRODUCTION',
    withProxyHeader = true,
  }: IGetMarketingEventsParams = {}): Promise<IAppMarketingEvent[]> {
    try {
      const response = await this._httpProvider.get<DataResponse<IMarketingEventApiResponse[]>>({
        url: `${CasperWalletApiEndpoints[env]}/marketing-events`,
        errorType: 'getMarketingEvents',
        ...(withProxyHeader ? { headers: CSPR_API_PROXY_HEADERS } : {}),
      });

      return response?.data?.map(evt => new AppMarketingEventDto(evt)) ?? [];
    } catch (e) {
      throw new AppEventsError(e, 'getMarketingEvents');
    }
  }
}
