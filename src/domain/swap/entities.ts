export interface IDexToken {
  readonly id: string; // contract package hash, or the literal 'cspr' for the synthetic native token
  readonly name: string;
  readonly symbol: string;
  readonly icon: string | null;
  readonly decimals: number;
  readonly packageHash: string;
  readonly isWhitelisted: boolean;
  readonly isBlacklisted: boolean;
  readonly fiatRates: number | null;
  readonly totalValueLocked: string | null;
  readonly volume24h: string | null;
}

export type IDexTokenWithAmount = IDexToken & {
  amountFormatted: string;
  amountRaw: string;
  fiatAmount?: string;
};

export enum SwapQuoteType {
  ExactIn = 1,
  ExactOut = 2,
}

export interface ISwapQuote {
  readonly amountIn: string;
  readonly amountOut: string;
  readonly executionPrice: string;
  readonly midPrice: string;
  readonly path: string[];
  readonly priceImpact: string;
  readonly recommendedSlippageBps: string;
  readonly typeId: SwapQuoteType;
  readonly amountInDecimal: string; // derived client-side, not an API field
  readonly amountOutDecimal: string; // derived client-side
  readonly rate: string; // derived client-side
}

export enum FetchQuoteErrorCodes {
  InvalidAmount = 'invalid_input',
  NotFound = 'not_found',
}

// Below: raw indexer-API payload shapes (snake_case retained field-for-field), not mapped
// domain entities.

export interface IDexTokenMarketData {
  readonly currency_id: number;
  readonly dex_id: number;
  readonly latest_rate: number;
  readonly timestamp: string;
  readonly token_contract_package_hash: string;
  readonly token_volume_24h: string;
  readonly volume_24h: string;
}

export interface IDexCsprTradeData {
  readonly price: number;
  readonly volume_24h: number;
}

export interface IDexTokenMetadata {
  readonly balances_uref: string;
  readonly decimals: number;
  readonly name: string;
  readonly symbol: string;
  readonly total_supply_uref: string;
}

export interface IDexContractPackage {
  readonly contract_package_hash: string;
  readonly owner_public_key: string;
  readonly owner_hash: string;
  readonly name: string;
  readonly description: string | null;
  readonly metadata: IDexTokenMetadata;
  readonly latest_version_contract_type_id: number;
  readonly timestamp: string;
  readonly icon_url: string | null;
  readonly website_url: string | null;
  readonly coingecko_id: string | null;
  readonly latest_version_contract_hash: string | null;
  readonly account_info: unknown | null;
  readonly centralized_account_info: unknown | null;
  readonly coingecko_data: unknown | null;
  readonly friendlymarket_data: unknown | null;
  /** @deprecated Use `token_market_data` instead */
  readonly csprtrade_data: IDexCsprTradeData | null;
  readonly token_market_data: IDexTokenMarketData[] | null;
}
