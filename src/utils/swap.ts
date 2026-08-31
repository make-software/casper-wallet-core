import {
  BLOCK_INTERVAL_MS,
  CSPR_DECIMALS,
  CSPR_NATIVE_TOKEN_ID,
  DEX_PAYMENT_AMOUNT,
  FIAT_DECIMALS,
  MAX_DEADLINE,
  MAX_SLIPPAGE,
  MIN_DEADLINE,
  MIN_SLIPPAGE,
  NO_FIAT_RATE_LABEL,
  POSSIBLE_QUOTE_LATENCY_MS,
  SWAP_PROTOCOL_FEE,
  TOKEN_DISPLAY_DECIMALS,
} from '../domain/constants';
import { LedgerError } from '../domain/ledger/errors';
import type { IDexToken } from '../domain/swap/entities';
import { SwapQuoteType } from '../domain/swap/entities';
import {
  formatFiatBalance,
  formatTokenBalance,
  getBlockchainAmount,
  getDecimalTokenBalance,
} from './common';
import { AmountDecimal as D } from './decimal';

export type TokenPosition = 'first' | 'second';
export type WcsprDisplay = 'wrapped' | 'native';

const formatDecimalAmount = (amount: string, maxDecimals = TOKEN_DISPLAY_DECIMALS): string =>
  formatTokenBalance(amount, 0, maxDecimals, '0', true);

export const calculateSwapRate = (
  token1amount: string | null,
  token1decimal: number | null,
  token2amount: string | null,
  token2decimal: number | null,
  quoteType: SwapQuoteType,
): string => {
  const token1 = new D(getDecimalTokenBalance(token1amount ?? '0', token1decimal ?? 0));
  const token2 = new D(getDecimalTokenBalance(token2amount ?? '0', token2decimal ?? 0));

  const [numerator, denominator] =
    quoteType === SwapQuoteType.ExactIn ? [token2, token1] : [token1, token2];

  return formatDecimalAmount(numerator.div(denominator).toFixed(10), 10);
};

export const calculateSwapFee = (
  decimalAmount: string,
  fee: number = SWAP_PROTOCOL_FEE,
): string => {
  if (!decimalAmount) {
    return '0';
  }

  return formatDecimalAmount(new D(decimalAmount).mul(fee).toFixed(6));
};

export const calculateSwapMaxSlippage = (slippageBps?: string): string | null => {
  if (!slippageBps) {
    return null;
  }

  return new D(slippageBps).div(100).toFixed(2);
};

export const getMillisecondsUntilNextBlock = (lastBlockTimestamp: number): number => {
  const now = Date.now();
  const elapsedTime = now - lastBlockTimestamp;
  const remainderInCurrentPeriod = elapsedTime % BLOCK_INTERVAL_MS;

  return BLOCK_INTERVAL_MS - remainderInCurrentPeriod + POSSIBLE_QUOTE_LATENCY_MS;
};

// The token DTO maps the WCSPR API record to the synthetic CSPR token, so the real on-chain
// identity has to be rebuilt here for views that must link to the WCSPR contract page.
const buildWcsprAsItself = (
  csprToken: IDexToken | undefined,
  wrappedCsprPackageHash: string,
): IDexToken => ({
  id: wrappedCsprPackageHash,
  name: 'Wrapped Casper',
  symbol: 'WCSPR',
  icon: csprToken?.icon ?? null,
  decimals: csprToken?.decimals ?? 9,
  packageHash: wrappedCsprPackageHash,
  isWhitelisted: true,
  isBlacklisted: false,
  fiatRates: csprToken?.fiatRates ?? null,
  totalValueLocked: null,
  volume24h: null,
});

/**
 * `wcsprDisplay` selects how a WCSPR leg in the route is presented:
 * - 'native'  (default): the trade-form UX — show WCSPR as CSPR (id='cspr', symbol='CSPR').
 * - 'wrapped': the real on-chain WCSPR identity, so a historical Swaps row links to the
 *   actual WCSPR token-details page.
 */
export const getSwapRoutes = (
  routesHashes: string[] = [],
  tokens: IDexToken[] = [],
  wrappedCsprPackageHash: string,
  options: { wcsprDisplay?: WcsprDisplay } = {},
): IDexToken[] => {
  const { wcsprDisplay = 'native' } = options;

  return routesHashes
    .map(hash => {
      if (hash === wrappedCsprPackageHash) {
        const nativeCsprToken = tokens.find(token => token.id === CSPR_NATIVE_TOKEN_ID);

        return wcsprDisplay === 'wrapped'
          ? buildWcsprAsItself(nativeCsprToken, wrappedCsprPackageHash)
          : nativeCsprToken;
      }

      return tokens.find(token => token.packageHash.toLowerCase() === hash.toLowerCase());
    })
    .filter((token): token is IDexToken => Boolean(token));
};

export const getErrorMessageDescription = (code?: string | null): string | null => {
  if (!code) {
    return null;
  }

  if (code.toLowerCase() === 'not_found') {
    return 'Please select a different trading pair.';
  } else if (code.toLowerCase() === 'invalid_input') {
    return 'Please provide a higher input amount for a trade.';
  }

  return null;
};

const formatSwapFiatAmount = (amount: string, currencyCode: string): string =>
  formatFiatBalance(amount, null, FIAT_DECIMALS, {
    currencyCode,
    minFractionDigits: FIAT_DECIMALS,
  });

export const calculateTokenFiatAmount = (
  token: IDexToken | null,
  decimalAmount: string,
  currencyCode: string,
  tokenFiatRate?: number | null,
  csprFiatRate?: string | number | null,
): string => {
  if (!token) {
    return '';
  }

  const fiatRate = token.id === CSPR_NATIVE_TOKEN_ID ? csprFiatRate : tokenFiatRate;

  if (!fiatRate) {
    return NO_FIAT_RATE_LABEL;
  }

  return formatSwapFiatAmount(new D(decimalAmount || 0).mul(fiatRate).toFixed(), currencyCode);
};

export const calculateSwapPaymentAmount = (
  token1: IDexToken | null,
  token2: IDexToken | null,
  csprFiatRate: string | number | null,
  currencyCode: string,
): string | null => {
  if (!(token1 && token2)) {
    return null;
  }

  const paymentInMotes =
    token1.id === CSPR_NATIVE_TOKEN_ID || token2.id === CSPR_NATIVE_TOKEN_ID
      ? DEX_PAYMENT_AMOUNT.swapCsprForToken
      : DEX_PAYMENT_AMOUNT.swapTokenForToken;

  const amount = getDecimalTokenBalance(paymentInMotes, CSPR_DECIMALS);

  return csprFiatRate
    ? formatSwapFiatAmount(new D(amount).mul(csprFiatRate).toFixed(), currencyCode)
    : `${amount} CSPR`;
};

const calculateAvailableCsprBalance = (balance: string, context: 'swap' | 'wrap'): string => {
  try {
    const balanceInMotes = new D(getBlockchainAmount(balance, CSPR_DECIMALS));

    const totalPaymentAmount =
      context === 'swap'
        ? new D(DEX_PAYMENT_AMOUNT.approve).plus(DEX_PAYMENT_AMOUNT.swapCsprForToken)
        : new D(DEX_PAYMENT_AMOUNT.wrap);

    const availableBalanceInMotes = balanceInMotes.minus(totalPaymentAmount);

    if (availableBalanceInMotes.lte(0)) {
      return '0';
    }

    return getDecimalTokenBalance(availableBalanceInMotes.toFixed(0), CSPR_DECIMALS);
  } catch {
    return balance;
  }
};

/**
 * Maximum usable balance for a token, reserving gas for the approve + swap (or wrap) payments
 * when the token is native CSPR.
 */
export const calculateMaxUsableBalance = (params: {
  balance: string;
  symbol: string;
  context: 'swap' | 'wrap';
}): string => {
  const { balance, symbol, context } = params;

  try {
    if (symbol === 'CSPR') {
      return calculateAvailableCsprBalance(balance, context);
    }

    return balance || '0';
  } catch {
    return balance || '0';
  }
};

/**
 * Normalize an unknown transaction error into a human-readable message.
 *
 * Failures arrive in several shapes — an Error instance (cancellation / send error), a plain
 * `{ message }` object (processed-with-error / expired / timeout callbacks), or a bare string
 * — so the UI can show the real reason instead of a generic fallback.
 *
 * A `LedgerError` returns its device status alone. Its `message` is the JSON of the whole event,
 * which carries the public key and transaction hash and is not something to render.
 */
export const getTransactionErrorMessage = (
  error: unknown,
  fallback = 'Transaction failed',
): string => {
  if (error instanceof LedgerError) {
    return error.ledgerEvent.status;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const { message } = error as { message: unknown };

    return typeof message === 'string' ? message : fallback;
  }

  return fallback;
};

export const handleTokenSelection = (
  currentState: { first: IDexToken | null; second: IDexToken | null },
  selectedToken: IDexToken,
  activePosition: TokenPosition,
): { first: IDexToken | null; second: IDexToken | null } => {
  const otherPosition: TokenPosition = activePosition === 'first' ? 'second' : 'first';

  // Picking the token that already sits in the other position swaps the two rather than
  // leaving it selected twice.
  if (currentState[otherPosition]?.id === selectedToken.id) {
    return {
      ...currentState,
      [activePosition]: selectedToken,
      [otherPosition]: currentState[activePosition],
    };
  }

  return {
    ...currentState,
    [activePosition]: selectedToken,
  };
};

export const clampSlippageValue = (value: number): number => {
  if (Number.isNaN(value) || value < MIN_SLIPPAGE) {
    return MIN_SLIPPAGE;
  }

  if (value > MAX_SLIPPAGE) {
    return MAX_SLIPPAGE;
  }

  return value;
};

export const clampDeadlineValue = (value: number): number => {
  if (Number.isNaN(value) || value < MIN_DEADLINE) {
    return MIN_DEADLINE;
  }

  if (value > MAX_DEADLINE) {
    return MAX_DEADLINE;
  }

  return value;
};
