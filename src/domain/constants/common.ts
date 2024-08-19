import { CloudPaginatedResponse, PaginatedResponse } from '../common';

export const EMPTY_PAGINATED_RESPONSE: PaginatedResponse<never> = {
  data: [],
  itemCount: 0,
  pageCount: 0,
  pages: [],
};

export const EMPTY_CLOUD_PAGINATED_RESPONSE: CloudPaginatedResponse<never> = {
  data: [],
  item_count: 0,
  page_count: 0,
  pages: [],
};
