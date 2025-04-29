export interface IAppReleaseEvent {
  readonly breaking: boolean;
  readonly releaseNotes: string[];
  readonly released: boolean;
  readonly version: string;
}

export interface IAppMarketingEvent {
  readonly id: number;
  readonly name: string;
  readonly description: string;
  readonly endAt: string;
  readonly startAt: string;
}
