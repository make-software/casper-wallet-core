import type { IDexContractPackage } from '../../../domain';

/** Raw record shape returned by GET /tokens and GET /tokens/{hash}. */
export interface DexTokenApiResponse {
  contract_package_hash: string;
  contract_package: IDexContractPackage;
  is_blacklisted: boolean;
  is_whitelisted: boolean;
  sorting_order: number;
  total_value_locked: string;
}

/** Raw GET /quote response, before the client-side amountInDecimal/amountOutDecimal/rate derivations. */
export interface RawSwapQuote {
  amount_in: string;
  amount_out: string;
  execution_price: string;
  mid_price: string;
  path: string[];
  price_impact: string;
  recommended_slippage_bps: string;
  type_id: number;
}

/** Raw GET /rates/{currencyId}/latest response. */
export interface CsprFiatRateApiResponse {
  amount: number;
  created: string;
  currency_id: number;
}

/** Raw GET /ft/{hash}/rates/latest response. */
export interface TokenFiatRateApiResponse {
  amount: string;
  currency_id: number;
  dex_id: number;
  timestamp: string;
  token_contract_package_hash: string;
  transaction_hash: string;
}
