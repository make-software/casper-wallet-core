import type { Maybe } from '../../../typings';
import type { ITokenMarketData } from '../contractPackage';

/** Raw record shape returned by GET /tokens and GET /tokens/{hash}. */
export interface DexTokenApiResponse {
  contract_package_hash: string;
  contract_package: DexContractPackage;
  is_blacklisted: boolean;
  is_whitelisted: boolean;
  sorting_order: number;
  total_value_locked: string;
}

/** Fields of the nested `contract_package` record that `DexTokenDto` reads. */
export interface DexContractPackage {
  contract_package_hash: string;
  name: string;
  metadata: DexTokenMetadata;
  icon_url: Maybe<string>;
  token_market_data: Maybe<ITokenMarketData[]>;
}

export interface DexTokenMetadata {
  decimals: number;
  name: string;
  symbol: string;
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
