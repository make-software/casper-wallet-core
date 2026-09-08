export const PINCODE_ATTEMPTS_BEFORE_CLEAN_UP = 10;
export const REQUEST_TIMEOUT = 20 * 1000;
export const FIAT_DECIMALS = 2;
export const TOKEN_DISPLAY_DECIMALS = 5;
export const DEFAULT_PAGE_LIMIT = 10;

export const RETINA_SCALE = 2;
export const IMAGE_WIDTH = 376;
export const CACHE_TTL = '2592000';

export const CSPR_API_PROXY_HEADERS = { Referer: 'https://casperwallet.io' };

export const ZERO_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Synthetic native-token id for the swap domain: the trade API has no record for native CSPR,
 * so the token list maps the WCSPR record onto this id and `token.id === CSPR_NATIVE_TOKEN_ID`
 * becomes the native-leg check. Distinct from `CSPR_COIN.id`, which identifies the coin in the
 * wallet's own balance list.
 */
export const CSPR_NATIVE_TOKEN_ID = 'cspr';

export const DEFAULT_SLIPPAGE = 3;
export const MIN_SLIPPAGE = 0.01;
export const MAX_SLIPPAGE = 50;
export const DEFAULT_DEADLINE = 20; // minutes
export const MIN_DEADLINE = 1;
export const MAX_DEADLINE = 120;

// Motes, as strings.
export const DEX_PAYMENT_AMOUNT = {
  approve: '5000000000', // 5 CSPR
  swapCsprForToken: '30000000000', // 30 CSPR
  swapTokenForToken: '30000000000', // 30 CSPR
  wrap: '5000000000', // 5 CSPR
  unwrap: '5000000000', // 5 CSPR
} as const;

export const DEX_TRANSACTION_TTL_MS = 1800000;
export const SWAP_PROTOCOL_FEE = 0.003;
export const SWAP_PRICE_IMPACT_WARNING_THRESHOLD = 10; // %
export const HIGH_SLIPPAGE_WARNING_THRESHOLD = 10; // %
export const BLOCK_INTERVAL_MS = 8000;
export const POSSIBLE_QUOTE_LATENCY_MS = 500;
export const NO_FIAT_RATE_LABEL = 'N/A';
