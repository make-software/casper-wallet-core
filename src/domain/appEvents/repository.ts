import { IAppMarketingEvent, IAppReleaseEvent } from './entities';
import { IEnv } from '../env';

export interface IAppEventsRepository {
  // TODO Currently only for mobile
  getReleaseEvents(params: IGetReleaseUpdatesParams): Promise<IAppReleaseEvent[]>;
  getMarketingEvents(params?: IGetMarketingEventsParams): Promise<IAppMarketingEvent[]>;
}

export interface IGetReleaseUpdatesParams {
  currentVersion: string;
  env?: IEnv;
  withProxyHeader?: boolean;
}

export interface IGetMarketingEventsParams {
  env?: IEnv;
  withProxyHeader?: boolean;
}
