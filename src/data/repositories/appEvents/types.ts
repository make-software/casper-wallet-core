export interface IMarketingEventApiResponse {
  description: string;
  end_at: string;
  id: number;
  name: string;
  start_at: string;
}

export interface IReleaseEventApiResponse {
  breaking: boolean;
  release_notes: string[];
  released: boolean;
  version: string;
}
