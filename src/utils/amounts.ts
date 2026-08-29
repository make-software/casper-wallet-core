import Decimal from 'decimal.js';

/**
 * All amounts are plain strings: `raw` = motes/base units, `formatted` = decimal string.
 *
 * A local high-precision clone is used instead of the global `Decimal` so this module never
 * mutates shared config, and because the default precision (20 sig. digits) would truncate
 * large motes values mid-chain.
 */
const D = Decimal.clone({ precision: 50, toExpNeg: -50, toExpPos: 50 });

/**
 * Convert a raw (motes) amount to a formatted (decimal) amount: `rawAmount / 10 ^ decimals`.
 *
 * @throws Error if rawAmount is empty or decimals is not a non-negative integer
 */
export const rawToFormatted = (rawAmount: string, decimals: number): string => {
  if (!rawAmount || rawAmount === '') {
    throw new Error('rawAmount cannot be empty');
  }

  if (decimals < 0 || !Number.isInteger(decimals)) {
    throw new Error(`decimals must be a non-negative integer, got ${decimals}`);
  }

  try {
    const divisor = new D(10).pow(decimals);

    return new D(rawAmount).div(divisor).toFixed();
  } catch (error) {
    throw new Error(
      `Failed to convert RawAmount to FormattedAmount: rawAmount="${rawAmount}", decimals=${decimals}. Error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

/**
 * Convert a formatted (decimal) amount to a raw (motes) amount:
 * `formattedAmount * 10 ^ decimals`, rounded DOWN so the result never exceeds the balance.
 *
 * @throws Error if formattedAmount is empty or decimals is not a non-negative integer
 */
export const formattedToRaw = (formattedAmount: string, decimals: number): string => {
  if (!formattedAmount || formattedAmount === '') {
    throw new Error('formattedAmount cannot be empty');
  }

  if (decimals < 0 || !Number.isInteger(decimals)) {
    throw new Error(`decimals must be a non-negative integer, got ${decimals}`);
  }

  try {
    const multiplier = new D(10).pow(decimals);

    return new D(formattedAmount).times(multiplier).toFixed(0, Decimal.ROUND_DOWN);
  } catch (error) {
    throw new Error(
      `Failed to convert FormattedAmount to RawAmount: formattedAmount="${formattedAmount}", decimals=${decimals}. Error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

/** Safe variant of {@link rawToFormatted} — swallows errors and returns `fallback` (default `'0'`). */
export const rawToFormattedSafe = (rawAmount: string, decimals: number, fallback = '0'): string => {
  try {
    return rawToFormatted(rawAmount, decimals);
  } catch (error) {
    console.warn(
      `rawToFormattedSafe: Failed to convert "${rawAmount}" with decimals ${decimals}:`,
      error instanceof Error ? error.message : String(error),
    );

    return fallback;
  }
};

/** Safe variant of {@link formattedToRaw} — swallows errors and returns `fallback` (default `'0'`). */
export const formattedToRawSafe = (
  formattedAmount: string,
  decimals: number,
  fallback = '0',
): string => {
  try {
    return formattedToRaw(formattedAmount, decimals);
  } catch (error) {
    console.warn(
      `formattedToRawSafe: Failed to convert "${formattedAmount}" with decimals ${decimals}:`,
      error instanceof Error ? error.message : String(error),
    );

    return fallback;
  }
};

/**
 * Minimum acceptable amount with slippage protection:
 * `expectedAmount * (1 - slippagePercent / 100)`, rounded DOWN to protect the user.
 */
export const calculateMinAmountWithSlippage = (
  expectedAmount: string,
  slippagePercent: number,
): string => {
  try {
    const factor = new D(1).minus(new D(slippagePercent).div(100));

    return new D(expectedAmount).times(factor).toFixed(0, Decimal.ROUND_DOWN);
  } catch (error) {
    throw new Error(
      `Failed to calculate min amount with slippage: expectedAmount="${expectedAmount}", slippage="${slippagePercent}". Error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

/**
 * Maximum acceptable amount with slippage protection:
 * `expectedAmount * (1 + slippagePercent / 100)`, rounded UP to protect the protocol.
 */
export const calculateMaxAmountWithSlippage = (
  expectedAmount: string,
  slippagePercent: number,
): string => {
  try {
    const factor = new D(1).plus(new D(slippagePercent).div(100));

    return new D(expectedAmount).times(factor).toFixed(0, Decimal.ROUND_UP);
  } catch (error) {
    throw new Error(
      `Failed to calculate max amount with slippage: expectedAmount="${expectedAmount}", slippage="${slippagePercent}". Error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

/** Percentage of an amount: `amount * (percentage / 100)`, where `percentage` is 0–100. */
export const calculatePercentageOf = (amount: string, percentage: string | number): string => {
  try {
    return new D(amount).times(new D(percentage)).div(100).toString();
  } catch (error) {
    throw new Error(
      `Failed to calculate percentage of amount: amount="${amount}", percentage="${percentage}". Error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

/**
 * Parse a user-typed slippage input into a number, truncated to 2 decimal places.
 *
 * Accepts a comma as decimal separator (e.g. "1,5"); returns `0` for anything unparseable.
 */
export const getSlippageNumberFromInput = (slippage: string): number => {
  try {
    const normalized = (slippage ?? '').toString().trim().replace(/,/g, '.');

    // Allow: "", "123", "123.", ".5", "123.45"
    if (!/^\d*(\.\d*)?$/.test(normalized)) {
      return 0;
    }

    return new D(new D(normalized || 0).toFixed(2, Decimal.ROUND_DOWN)).toNumber();
  } catch {
    return 0;
  }
};

/** `true` if `amount` is a non-empty, valid, strictly positive number string (`'0'` is invalid). */
export const isValidAmount = (amount: string): boolean => {
  if (!amount || amount === '0' || amount === '') return false;
  const numValue = parseFloat(amount);

  return !isNaN(numValue) && numValue > 0;
};

/**
 * `true` if `amount` is acceptable as in-progress user input: empty string is allowed, must
 * be digits with an optional single dot, and (if `decimals` is given) capped to that many
 * fraction digits.
 */
export const isAmountValid = (amount: string, decimals?: number): boolean => {
  if (amount === '') return true;

  if (!/^\d*\.?\d*$/.test(amount)) return false;

  if (typeof decimals === 'number' && decimals >= 0) {
    const dotIndex = amount.indexOf('.');
    if (dotIndex !== -1) {
      const fractionLength = amount.length - dotIndex - 1;
      if (fractionLength > decimals) return false;
    }
  }

  return true;
};

/** `true` if `amount` has more fraction digits than `decimals`. */
export const exceedsMaxDecimals = (amount: string, decimals: number): boolean => {
  const parts = amount.split('.');
  if (parts.length === 1) return false;

  return parts[1].length > decimals;
};

/** Truncates `amount`'s fraction part to `decimals` digits (string-level, no rounding). */
export const clampAmountToDecimals = (amount: string, decimals: number): string => {
  if (amount === '') return '';
  const dotIndex = amount.indexOf('.');
  if (dotIndex === -1) return amount;
  if (decimals <= 0) return amount.slice(0, dotIndex);

  const intPart = amount.slice(0, dotIndex);
  const fracPart = amount.slice(dotIndex + 1, dotIndex + 1 + decimals);

  return `${intPart}.${fracPart}`;
};

/** `true` if `amount` is strictly greater than `balance`; invalid input returns `false`. */
export const doesAmountExceedBalance = (amount: string, balance: string | number): boolean => {
  if (!amount) return false;

  try {
    return new D(amount).gt(new D(balance));
  } catch {
    return false;
  }
};

/** Validates a Casper contract package hash: exactly 64 lowercase hexadecimal characters. */
export const isValidContractPackageHash = (hash: string): boolean => {
  return /^[0-9a-f]{64}$/i.test(hash.trim());
};

const APPROVAL_BUFFER_PERCENT = 20;

/**
 * Raw amount to approve for a spender: the balance plus a {@link APPROVAL_BUFFER_PERCENT}%
 * buffer, so a balance that grows slightly between approval and swap still clears. Truncated
 * to whole base units.
 */
export const calculateApprovalAmount = (balance: string): string => {
  if (!balance || balance === '0') {
    return '0';
  }

  return new D(balance)
    .times(100 + APPROVAL_BUFFER_PERCENT)
    .div(100)
    .toFixed(0, Decimal.ROUND_DOWN);
};

/** Total CSPR (in motes) required to cover a transaction amount plus its fee. */
export const calculateTotalCSPRRequired = (
  csprAmountInMotes: string,
  transactionFeeInMotes: string,
): string => {
  return new D(csprAmountInMotes).plus(new D(transactionFeeInMotes)).toFixed(0);
};

/** `true` if `liquidCsprBalance` covers `csprAmountNeeded` plus `transactionFeeInMotes` (all in motes). */
export const hasEnoughCSPRBalance = (
  liquidCsprBalance: string,
  csprAmountNeeded: string,
  transactionFeeInMotes: string,
): boolean => {
  const totalNeeded = calculateTotalCSPRRequired(csprAmountNeeded, transactionFeeInMotes);

  return new D(liquidCsprBalance).gte(new D(totalNeeded));
};
