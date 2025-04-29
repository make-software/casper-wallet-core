import {
  AppEventsError,
  AppEventsErrorType,
  CasperWalletApiEndpoints,
  CSPR_API_PROXY_HEADERS,
  DataResponse,
  IAppEventsRepository,
  IAppMarketingEvent,
  IAppReleaseEvent,
  IGetActiveMarketingEventParams,
  IGetMarketingEventsParams,
  IGetReleaseUpdatesParams,
  IHttpDataProvider,
  isAppEventsError,
} from '../../../domain';
import { IMarketingEventApiResponse, IReleaseEventApiResponse } from './types';
import { AppMarketingEventDto, AppReleaseEventDto } from '../../dto';
import { Maybe } from 'src/typings';
import { isAppEventActive } from '../../../utils';

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
      this._processError(e, 'getReleaseEvents');
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
      this._processError(e, 'getMarketingEvents');
    }
  }

  async getActiveMarketingEvent({
    env,
    withProxyHeader,
    ignoreEventIds,
  }: IGetActiveMarketingEventParams): Promise<Maybe<IAppMarketingEvent>> {
    try {
      const events = await this.getMarketingEvents({ env, withProxyHeader });

      return (
        events
          .filter(evt => isAppEventActive(evt))
          .filter(evt => !ignoreEventIds.includes(evt.id))?.[0] ?? null
      );
    } catch (e) {
      this._processError(e, 'getActiveMarketingEvent');
    }
  }

  private _processError(e: unknown, type: AppEventsErrorType): never {
    if (isAppEventsError(e)) {
      throw e;
    }

    throw new AppEventsError(e, type);
  }
}
