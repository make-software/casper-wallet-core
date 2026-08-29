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
  readonly amount_in: string;
  readonly amount_out: string;
  readonly execution_price: string;
  readonly mid_price: string;
  readonly path: string[];
  readonly price_impact: string;
  readonly recommended_slippage_bps: string;
  readonly type_id: SwapQuoteType;
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

export interface IDexTokenInfo {
  readonly contract_package_hash: string;
  readonly is_whitelisted: boolean;
  readonly is_blacklisted: boolean;
  readonly sorting_order: number;
}

export interface IAccountTokenOwnershipItem {
  readonly balance: string;
  readonly contract_package: IDexContractPackage;
  readonly contract_package_hash: string;
  readonly owner_hash: string;
  readonly owner_type: number;
}

/**
 * Generic CL envelope shape returned by the indexer API for transaction args.
 * Parsing is delegated to casper-js-sdk — this type only describes the JSON shape.
 */
export interface IDexCLEnvelope<TParsed = unknown> {
  readonly cl_type: unknown;
  readonly parsed: TParsed;
}

export interface IDexSwapApiTransactionArgs {
  readonly amount: IDexCLEnvelope<string>;
  readonly args: IDexCLEnvelope<number[]>;
  readonly attached_value: IDexCLEnvelope<string>;
  readonly entry_point: IDexCLEnvelope<string>;
  readonly package_hash: IDexCLEnvelope<string>;
}

export interface IDexSwapApiTransaction {
  readonly args: IDexSwapApiTransactionArgs;
  readonly block_hash: string;
  readonly block_height: number;
  readonly caller_hash: string;
  readonly caller_public_key: string;
  readonly consumed_gas: string;
  readonly contract_hash: string;
  readonly contract_package_hash: string;
  readonly cost: string;
  readonly deploy_hash: string;
  readonly entry_point_id: number;
  readonly error_message: string | null;
  readonly execution_type_id: number;
  readonly gas_price_limit: number;
  readonly is_standard_payment: boolean;
  readonly payment_amount: string;
  readonly pricing_mode_id: number;
  readonly refund_amount: string;
  readonly runtime_type_id: number;
  readonly status: string;
  readonly timestamp: string;
  readonly version_id: number;
}

export interface ISwapHistoryEntry {
  readonly amount0_in: string | null;
  readonly amount0_out: string | null;
  readonly amount1_in: string | null;
  readonly amount1_out: string | null;
  readonly block_height: number;
  readonly decimals0: number;
  readonly decimals1: number;
  readonly dex_id: number;
  readonly pair_contract_package_hash: string;
  readonly sender_hash: string;
  readonly timestamp: string;
  readonly token0_contract_package: IDexContractPackage;
  readonly token0_contract_package_hash: string;
  readonly token0_ft_rate: number | null;
  readonly token1_contract_package: IDexContractPackage;
  readonly token1_contract_package_hash: string;
  readonly token1_ft_rate: number | null;
  readonly transaction_hash: string;
  readonly transform_id: number;
  readonly token0?: IDexTokenInfo;
  readonly token1?: IDexTokenInfo;
  readonly transaction?: IDexSwapApiTransaction;
}
