import { IAppMarketingEvent, IAppReleaseEvent } from '../../domain';
import { IMarketingEventApiResponse, IReleaseEventApiResponse } from '../repositories';

export class AppReleaseEventDto implements IAppReleaseEvent {
  constructor(apiEvent?: Partial<IReleaseEventApiResponse>) {
    this.breaking = apiEvent?.breaking ?? false;
    this.releaseNotes = apiEvent?.release_notes ?? [];
    this.released = apiEvent?.released ?? false;
    this.version = apiEvent?.version ?? '';
  }

  readonly breaking: boolean;
  readonly releaseNotes: string[];
  readonly released: boolean;
  readonly version: string;
}

export class AppMarketingEventDto implements IAppMarketingEvent {
  constructor(apiEvent?: Partial<IMarketingEventApiResponse>) {
    this.id = apiEvent?.id ?? 0;
    this.name = apiEvent?.name ?? '';
    this.description = apiEvent?.description ?? '';
    this.endAt = apiEvent?.end_at ?? '';
    this.startAt = apiEvent?.start_at ?? '';
  }

  readonly id: number;
  readonly name: string;
  readonly description: string;
  readonly endAt: string;
  readonly startAt: string;
}
