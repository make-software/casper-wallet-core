import type { CasperNetwork } from '../common/common';

export const TradeApiUrl: Record<CasperNetwork, string> = {
  mainnet: 'https://api.cspr.trade',
  testnet: 'https://api.testnet.cspr.trade',
  devnet: '',
  integration: '',
};

// Package hashes without the `hash-` prefix.
export const TradeContractPackageHash: Record<CasperNetwork, string> = {
  mainnet: '1dbac65585475fec53e5b1f9110923c8d232921702097e83105b36751d682186',
  testnet: '04a11a367e708c52557930c4e9c1301f4465100d1b1b6d0a62b48d3e32402867',
  devnet: '',
  integration: '',
};

export const WrappedCsprContractPackageHash: Record<CasperNetwork, string> = {
  mainnet: '8df5d26790e18cf0404502c62ce5dc9025800ad6975c97466e20506c39c505b6',
  testnet: '3d80df21ba4ee4d66a2a1f60c32570dd5685e4b279f6538162a5fd1314847c1e',
  devnet: '',
  integration: '',
};

export const CSPR_TOKEN = { id: 'cspr', symbol: 'CSPR', decimals: 9 } as const;
export const ZERO_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

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
// The opaque suffixes are kept identical to the cspr-trade web app's keys so a user's stored
// settings can migrate — do not rename.
export const SLIPPAGE_STORAGE_KEY = 'slippage-asdg9';
export const DEADLINE_STORAGE_KEY = 'deadline-98dds';
