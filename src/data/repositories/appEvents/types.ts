import { Maybe } from '../../../typings';

export interface IMarketingEventApiResponse {
  description: string;
  end_at: Maybe<string>;
  id: number;
  name: string;
  start_at: string;
  url: string;
}

export interface IReleaseEventApiResponse {
  breaking: boolean;
  release_notes: string[];
  released: boolean;
  version: string;
}
