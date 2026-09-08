import { PaginatedResponse, SupportedFiatCurrencies } from '../common';

export const EMPTY_PAGINATED_RESPONSE: PaginatedResponse<never> = {
  data: [],
  itemCount: 0,
  pageCount: 0,
  pages: [],
};

/**
 * The library reports one fiat currency (see `SupportedFiatCurrencies`); these pin the two
 * representations of it — the trade API's numeric currency id and the ISO code used for display.
 */
export const USD_CURRENCY_ID = 1;
export const USD_CURRENCY_CODE: SupportedFiatCurrencies = 'USD';
