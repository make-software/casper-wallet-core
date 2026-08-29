import Decimal from 'decimal.js';

import type { IDexToken } from '../domain/swap/entities';
import { SwapQuoteType } from '../domain/swap/entities';

/**
 * A local high-precision clone is used instead of the global `Decimal` for the same reason as
 * `utils/amounts.ts`: never mutate shared config, and keep full precision through div/mul chains.
 */
const D = Decimal.clone({ precision: 50, toExpNeg: -50, toExpPos: 50 });

const SWAP_PROTOCOL_FEE = 0.003;
const BLOCK_INTERVAL_MS = 8000;
const POSSIBLE_QUOTE_LATENCY_MS = 500;
const NO_FIAT_RATE_LABEL = 'N/A';

// The synthetic native token: detection everywhere in the swap domain is `token.id === 'cspr'`.
const CSPR_NATIVE_TOKEN_ID = 'cspr';

const MIN_SLIPPAGE = 0.01;
const MAX_SLIPPAGE = 50;
const MIN_DEADLINE = 1;
const MAX_DEADLINE = 120;

// Gas attached to each contract call, in motes.
const APPROVE_PAYMENT_MOTES = 5_000_000_000;
const SWAP_CSPR_FOR_TOKEN_PAYMENT_MOTES = 30_000_000_000;
const SWAP_TOKEN_FOR_TOKEN_PAYMENT_MOTES = 30_000_000_000;
const WRAP_PAYMENT_MOTES = 5_000_000_000;

export type TokenPosition = 'first' | 'second';
export type WcsprDisplay = 'wrapped' | 'native';

export const tokenDivider = (decimals: number | null): Decimal => new D(10).pow(decimals || 0);

export const divideCEP18Balance = (
  balance: string | null,
  decimals: number | null,
): string | null => {
  if (balance == null) {
    return null;
  }

  return new D(balance).div(tokenDivider(decimals)).toFixed();
};

/**
 * Format a token amount for display, removing insignificant trailing decimals and padding to
 * a minimum number of decimals.
 */
export const formatTokenAmount = (
  amount: string | number,
  maxDecimals: number = 5,
  minDecimals: number = 2,
): string => {
  try {
    const num = new D(amount);

    if (num.eq(0)) {
      return '0';
    }

    let formatted = num.toFixed(maxDecimals);

    formatted = formatted.replace(/(\.\d*?)0+$/, '$1');
    formatted = formatted.replace(/\.$/, '');

    const parts = formatted.split('.');
    if (parts.length === 1) {
      formatted = `${formatted}.${'0'.repeat(minDecimals)}`;
    } else if (parts[1].length < minDecimals) {
      formatted = `${parts[0]}.${parts[1].padEnd(minDecimals, '0')}`;
    }

    return formatted;
  } catch {
    return '0';
  }
};

export const calculateSwapRate = (
  token1amount: string | null,
  token1decimal: number | null,
  token2amount: string | null,
  token2decimal: number | null,
  quoteType: SwapQuoteType,
): string => {
  const token1 = new D(token1amount ?? '0').div(tokenDivider(token1decimal ?? 0));
  const token2 = new D(token2amount ?? '0').div(tokenDivider(token2decimal ?? 0));

  return formatTokenAmount(
    (quoteType === SwapQuoteType.ExactIn ? token2 : token1)
      .div(quoteType === SwapQuoteType.ExactIn ? token1 : token2)
      .toFixed(10),
    10,
    2,
  );
};

export const calculateSwapFee = (
  decimalAmount: string,
  fee: number = SWAP_PROTOCOL_FEE,
): string => {
  if (!decimalAmount) {
    return '0';
  }

  return formatTokenAmount(new D(decimalAmount).mul(fee).toFixed(6));
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

const formatCurrency = (amount: string, currencyCode: string): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(
    Number(amount),
  );

export const formatSmallFiatAmount = (
  amount: string | number,
  currencyCode: string,
  precision = 2,
): string => {
  const decimalAmount = new D(amount);

  if (decimalAmount.lte(0)) {
    return formatCurrency('0', currencyCode);
  }

  const minDisplayValue = new D(1).div(new D(10).pow(precision));

  if (decimalAmount.lt(minDisplayValue)) {
    return `< ${formatCurrency(minDisplayValue.toFixed(precision), currencyCode)}`;
  }

  return formatCurrency(decimalAmount.toFixed(precision), currencyCode);
};

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

  if (token.id === CSPR_NATIVE_TOKEN_ID) {
    return csprFiatRate
      ? formatSmallFiatAmount(
          new D(decimalAmount || 0).mul(csprFiatRate).toFixed(),
          currencyCode,
          2,
        )
      : NO_FIAT_RATE_LABEL;
  }

  return tokenFiatRate
    ? formatSmallFiatAmount(new D(decimalAmount || 0).mul(tokenFiatRate).toFixed(), currencyCode, 2)
    : NO_FIAT_RATE_LABEL;
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

  const amount =
    token1.id === CSPR_NATIVE_TOKEN_ID || token2.id === CSPR_NATIVE_TOKEN_ID
      ? divideCEP18Balance(SWAP_CSPR_FOR_TOKEN_PAYMENT_MOTES.toString(), 9)
      : divideCEP18Balance(SWAP_TOKEN_FOR_TOKEN_PAYMENT_MOTES.toString(), 9);

  return csprFiatRate
    ? formatSmallFiatAmount(new D(amount ?? 0).mul(csprFiatRate).toFixed(), currencyCode, 2)
    : `${amount} CSPR`;
};

const calculateAvailableCsprBalance = (balance: string, context: 'swap' | 'wrap'): string => {
  try {
    const balanceInMotes = new D(balance).mul(1e9);
    let totalPaymentAmount = new D(0);

    switch (context) {
      case 'swap':
        totalPaymentAmount = totalPaymentAmount
          .plus(APPROVE_PAYMENT_MOTES)
          .plus(SWAP_CSPR_FOR_TOKEN_PAYMENT_MOTES);
        break;
      case 'wrap':
        totalPaymentAmount = totalPaymentAmount.plus(WRAP_PAYMENT_MOTES);
        break;
    }

    const availableBalanceInMotes = balanceInMotes.minus(totalPaymentAmount);

    if (availableBalanceInMotes.lte(0)) {
      return '0';
    }

    return availableBalanceInMotes.div(1e9).toFixed();
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
 */
export const getTransactionErrorMessage = (
  error: unknown,
  fallback = 'Transaction failed',
): string => {
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
