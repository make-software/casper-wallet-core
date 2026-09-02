import Decimal from 'decimal.js';

import { AmountDecimal as D } from './decimal';

/**
 * Minimum acceptable amount with slippage protection:
 * `expectedAmount * (1 - slippagePercent / 100)`, rounded DOWN to protect the user.
 *
 * @throws if `slippagePercent` is not a finite number in `[0, 100)`. A slippage of `100`
 * would yield `0` — a bound that permits any output at all — so it fails closed rather than
 * returning an unprotected amount.
 */
export const calculateMinAmountWithSlippage = (
  expectedAmount: string,
  slippagePercent: number,
): string => {
  if (!Number.isFinite(slippagePercent) || slippagePercent < 0 || slippagePercent >= 100) {
    throw new Error(
      `Failed to calculate min amount with slippage: slippage="${slippagePercent}" is outside [0, 100)`,
    );
  }

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
 *
 * @throws if `slippagePercent` is not a finite, non-negative number. A negative value would
 * invert the bound into a minimum.
 */
export const calculateMaxAmountWithSlippage = (
  expectedAmount: string,
  slippagePercent: number,
): string => {
  if (!Number.isFinite(slippagePercent) || slippagePercent < 0) {
    throw new Error(
      `Failed to calculate max amount with slippage: slippage="${slippagePercent}" must be a finite, non-negative number`,
    );
  }

  try {
    const factor = new D(1).plus(new D(slippagePercent).div(100));

    return new D(expectedAmount).times(factor).toFixed(0, Decimal.ROUND_UP);
  } catch (error) {
    throw new Error(
      `Failed to calculate max amount with slippage: expectedAmount="${expectedAmount}", slippage="${slippagePercent}". Error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

/** `true` if `amount` is a non-empty, valid, strictly positive number string (`'0'` is invalid). */
export const isPositiveAmount = (amount: string): boolean => {
  if (!amount || amount === '0' || amount === '') return false;
  const numValue = parseFloat(amount);

  return !isNaN(numValue) && numValue > 0;
};

/** `true` if `amount` has more fraction digits than `decimals`. */
export const exceedsMaxDecimals = (amount: string, decimals: number): boolean => {
  const parts = amount.split('.');
  if (parts.length === 1) return false;

  return parts[1].length > decimals;
};

/**
 * `true` if `amount` is acceptable as in-progress user input: empty string is allowed, must
 * be digits with an optional single dot, and (if `decimals` is given) capped to that many
 * fraction digits.
 */
export const isAmountInputValid = (amount: string, decimals?: number): boolean => {
  if (amount === '') return true;

  if (!/^\d*(\.\d*)?$/.test(amount)) return false;

  if (typeof decimals === 'number' && decimals >= 0) {
    return !exceedsMaxDecimals(amount, decimals);
  }

  return true;
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

const APPROVAL_BUFFER_PERCENT = 20;

/**
 * Raw amount to approve for a spender: `requiredAmount` plus a
 * {@link APPROVAL_BUFFER_PERCENT}% buffer, truncated to whole base units. Pass the same
 * amount the approval check is made against, so the grant always clears the check.
 * Returns `'0'` for an empty or zero input.
 */
export const calculateApprovalAmount = (requiredAmount: string): string => {
  if (!requiredAmount || requiredAmount === '0') {
    return '0';
  }

  return new D(requiredAmount)
    .times(100 + APPROVAL_BUFFER_PERCENT)
    .div(100)
    .toFixed(0, Decimal.ROUND_DOWN);
};

/** `true` if `liquidCsprBalance` covers `csprAmountNeeded` plus `transactionFeeInMotes` (all in motes). */
export const hasEnoughCSPRBalance = (
  liquidCsprBalance: string,
  csprAmountNeeded: string,
  transactionFeeInMotes: string,
): boolean => {
  const totalNeeded = new D(csprAmountNeeded).plus(new D(transactionFeeInMotes));

  return new D(liquidCsprBalance).gte(totalNeeded);
};
