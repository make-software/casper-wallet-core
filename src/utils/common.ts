import Decimal from 'decimal.js';

import { v4 } from 'uuid';
import { FIAT_DECIMALS, TOKEN_DISPLAY_DECIMALS } from '../domain';
import { Maybe } from '../typings';

export const noop = () => undefined;

export const capitalizeFirstLetter = (str: string): string =>
  str.charAt(0).toUpperCase() + str.slice(1);

export const formatFiatBalance = (
  balance?: string | number,
  defaultBalance = '$0.00',
  decimals = FIAT_DECIMALS,
): string => {
  if (!balance) {
    return defaultBalance;
  }

  return `$${new Decimal(balance)
    .toDecimalPlaces(decimals)
    .toNumber()
    .toLocaleString('en-US', { maximumFractionDigits: decimals })}`;
};

export const getDecimalTokenBalance = (balance: string | number, decimals: number) => {
  return new Decimal(balance).div(new Decimal(10).pow(decimals)).toFixed();
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

export const getBlockchainAmount = (decimalAmount: string, decimals: number) => {
  if (!decimalAmount || Number.isNaN(parseFloat(decimalAmount))) {
    throw new Error('Invalid amount');
  }

  return new Decimal(decimalAmount).mul(new Decimal(10).pow(decimals)).toFixed(0);
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
