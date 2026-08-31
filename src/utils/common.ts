import Decimal from 'decimal.js';

import { v4 } from 'uuid';
import { FIAT_DECIMALS, HIGH_STAKE_THRESHOLD, IValidator, TOKEN_DISPLAY_DECIMALS } from '../domain';
import { Maybe } from '../typings';
import { shiftDecimal } from './decimal';

export const noop = () => undefined;

export const capitalizeFirstLetter = (str: string): string =>
  str.charAt(0).toUpperCase() + str.slice(1);

export interface IFormatFiatBalanceOptions {
  /** ISO 4217 code. Defaults to USD. */
  currencyCode?: string;
  /** Pads short amounts — 2 renders `$5` as `$5.00`. Clamped to at most `decimals`. */
  minFractionDigits?: number;
}

const MIN_DISPLAYED_FIAT_AMOUNT = new Decimal('0.01');

/** The sub-cent label needs two places to say "one cent" at all, whatever `decimals` is. */
const MIN_DISPLAYED_FIAT_DECIMALS = 2;

/**
 * Format a fiat amount. Anything under one cent renders as `<$0.01`, whatever `decimals` is.
 *
 * `defaultBalance` covers an absent balance; pass `null` to render zero in `currencyCode`
 * instead of a fixed label.
 */
export const formatFiatBalance = (
  balance?: string | number,
  defaultBalance: Maybe<string> = '$0.00',
  decimals = FIAT_DECIMALS,
  { currencyCode = 'USD', minFractionDigits = 0 }: IFormatFiatBalanceOptions = {},
): string => {
  const format = (value: Decimal, maxFractionDigits = decimals): string =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      // `Intl.NumberFormat` throws a `RangeError` when the minimum exceeds the maximum, and this
      // is a render-path helper.
      minimumFractionDigits: Math.min(minFractionDigits, maxFractionDigits),
      maximumFractionDigits: maxFractionDigits,
    }).format(value.toNumber());

  if (!balance) {
    return defaultBalance ?? format(new Decimal(0));
  }

  const amount = new Decimal(balance);

  if (amount.lt(MIN_DISPLAYED_FIAT_AMOUNT)) {
    return `<${format(MIN_DISPLAYED_FIAT_AMOUNT, Math.max(decimals, MIN_DISPLAYED_FIAT_DECIMALS))}`;
  }

  return format(amount.toDecimalPlaces(decimals));
};

/**
 * Raw base units (motes) to a decimal string: `balance / 10 ^ decimals`.
 *
 * Pass `defaultBalance` to receive it instead of a throw when `balance` cannot be parsed.
 */
export const getDecimalTokenBalance = (
  balance: string | number,
  decimals: number,
  defaultBalance?: string,
): string => {
  try {
    return shiftDecimal(balance, -decimals).toFixed();
  } catch (error) {
    if (defaultBalance === undefined) {
      throw error;
    }

    return defaultBalance;
  }
};

export const formatTokenBalance = (
  balance: string | number,
  decimals: number,
  roundDecimals = TOKEN_DISPLAY_DECIMALS,
  defaultBalance = '0',
  isDecimalBalance = false,
): string => {
  if (!balance || Number.isNaN(Number(balance))) {
    return defaultBalance;
  }

  return new Decimal(isDecimalBalance ? balance : getDecimalTokenBalance(balance, decimals))
    .toDecimalPlaces(roundDecimals, Decimal.ROUND_FLOOR)
    .toNumber()
    .toLocaleString('en-US', {
      maximumFractionDigits: roundDecimals,
      minimumFractionDigits: 0,
    });
};

export const formatFiatAmountToTokenAmount = (
  fiatAmount: string,
  fiatRate: string | number,
): string =>
  new Decimal(parseFloat(fiatAmount || '0'))
    .div(fiatRate)
    .toDecimalPlaces(1)
    .toNumber()
    .toLocaleString('en-US', {
      maximumFractionDigits: 1,
      minimumFractionDigits: 0,
    });

export const getUniqueId = () => v4();

export const delay = (ms: number, callback?: () => void) =>
  new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      try {
        resolve(callback?.() || true);
      } catch (error) {
        reject(error);
      }
    }, ms);

    const cancel = () => {
      clearTimeout(timeoutId);
      reject(new Error('Delay cancelled'));
    };

    (resolve as any).cancel = cancel;
    (reject as any).cancel = cancel;
  });

/** check if secretKeys or publicKeys are equal without checksum */
export const isKeysEqual = (keyOne?: Maybe<string>, keyTwo?: Maybe<string>) => {
  if (!(keyOne && keyTwo)) {
    return false;
  }

  return keyOne.toLowerCase() === keyTwo.toLowerCase();
};

/**
 * Decimal string to raw base units (motes): `decimalAmount * 10 ^ decimals`, truncated.
 *
 * Pass `defaultAmount` to receive it instead of a throw when `decimalAmount` is not a number.
 */
export const getBlockchainAmount = (
  decimalAmount: string,
  decimals: number,
  defaultAmount?: string,
): string => {
  try {
    if (!decimalAmount || Number.isNaN(parseFloat(decimalAmount))) {
      throw new Error('Invalid amount');
    }

    return shiftDecimal(decimalAmount, decimals).toFixed(0, Decimal.ROUND_DOWN);
  } catch (error) {
    if (defaultAmount === undefined) {
      throw error;
    }

    return defaultAmount;
  }
};

export const formatFiatAmount = (
  csprFiatRate: number,
  balance?: string,
  decimals = FIAT_DECIMALS,
) => {
  const amount = new Decimal(parseFloat(balance || '0'))
    .mul(csprFiatRate)
    .toDecimalPlaces(decimals);

  const billion = new Decimal(10).pow(9);

  if (amount.gte(billion)) {
    // If the value is greater than or equal to 10^9, return empty string.
    // TODO: Clarify future behavior for large fiat amount
    return '';
  }

  return formatFiatBalance(amount.toString(), '$0.00', decimals);
};

export const formatNumber = (
  value: number | string,
  {
    precision,
    compactDisplay,
  }: {
    precision?: { min?: number; max?: number };
    compactDisplay?: 'short' | 'long';
  } = {},
): string => {
  let decimalValue = new Decimal(value);

  if (precision) {
    decimalValue = decimalValue.toDecimalPlaces(precision.max || precision.min || 0);
  }

  if (compactDisplay === 'short') {
    const formattedValue = decimalValue.toFixed();
    const [integerPart] = formattedValue.split('.');
    const groups = integerPart.split(/(?=(?:\d{3})+(?!\d))/);

    return groups.slice(0, 3).join(',');
  }

  return decimalValue.toFixed();
};

export function getFiatAmount(decimalTokenAmount: string | number, rate: string | number = 0) {
  return formatFiatBalance(new Decimal(decimalTokenAmount).mul(rate).toFixed(), undefined, 4);
}

export const isNotEmpty = <T extends any>(value?: Maybe<T>): value is T => Boolean(value);

export function getCep18FiatAmount(
  decimalAmount: string | number,
  rate?: string | number,
  formatted = false,
) {
  const isZeroRate = Number(rate ?? 0) === 0;

  if (isZeroRate) {
    return '';
  }

  return formatted
    ? formatFiatBalance(new Decimal(decimalAmount).mul(rate ?? 0).toFixed())
    : new Decimal(decimalAmount).mul(rate ?? 0).toFixed();
}

export const isHighStakeValidator = (validator: Pick<IValidator, 'networkShare'>): boolean => {
  const share = Number(validator.networkShare);
  return !Number.isNaN(share) && share >= HIGH_STAKE_THRESHOLD;
};

export const formatNetworkShare = (networkShare: Maybe<string>): Maybe<string> => {
  if (!networkShare) {
    return null;
  }
  const num = Number(networkShare);
  if (Number.isNaN(num)) {
    return null;
  }
  return formatNumber(num, { precision: { max: 2, min: 2 } });
};
