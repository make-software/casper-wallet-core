import Big from 'big.js';
import fc from 'fast-check';
import Decimal from 'decimal.js';

import {
  formatFiatAmountToTokenAmount,
  formatFiatBalance,
  getBlockchainAmount,
  getDecimalTokenBalance,
} from './common';

const bigIntString = (min: bigint, max: bigint) => fc.bigInt({ min, max }).map(String);

const MAX_INTEGER_BALANCE = 10n ** 30n;

const referenceToDecimal = (balance: string, decimals: number) =>
  new Big(balance).div(new Big(10).pow(decimals)).toFixed();

const referenceToRaw = (decimalAmount: string, decimals: number) =>
  new Big(decimalAmount).times(new Big(10).pow(decimals)).round(0, Big.roundDown).toFixed(0);

describe('getDecimalTokenBalance (property)', () => {
  it('matches the big.js reference', () => {
    fc.assert(
      fc.property(
        bigIntString(-MAX_INTEGER_BALANCE, MAX_INTEGER_BALANCE),
        fc.integer({ min: 0, max: 18 }),
        (balance, decimals) => {
          expect(getDecimalTokenBalance(balance, decimals)).toBe(
            referenceToDecimal(balance, decimals),
          );
        },
      ),
    );
  });

  it('round-trip: result * 10^decimals === balance', () => {
    fc.assert(
      fc.property(
        bigIntString(-MAX_INTEGER_BALANCE, MAX_INTEGER_BALANCE),
        fc.integer({ min: 0, max: 18 }),
        (balance, decimals) => {
          const result = getDecimalTokenBalance(balance, decimals);
          const restored = new Big(result).times(new Big(10).pow(decimals));
          expect(restored.toFixed()).toBe(new Big(balance).toFixed());
        },
      ),
    );
  });

  it('zero balance always yields "0"', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 18 }), decimals => {
        expect(getDecimalTokenBalance('0', decimals)).toBe('0');
      }),
    );
  });

  it('preserves sign', () => {
    fc.assert(
      fc.property(
        bigIntString(1n, MAX_INTEGER_BALANCE),
        fc.integer({ min: 0, max: 18 }),
        (positiveBalance, decimals) => {
          const positive = getDecimalTokenBalance(positiveBalance, decimals);
          const negative = getDecimalTokenBalance('-' + positiveBalance, decimals);
          expect(new Big(positive).gt(0)).toBe(true);
          expect(negative.startsWith('-')).toBe(true);
          expect(new Big(negative).neg().toFixed()).toBe(new Big(positive).toFixed());
        },
      ),
    );
  });

  it('shift identity: result(d) * 10 === result(d-1)', () => {
    fc.assert(
      fc.property(
        bigIntString(-MAX_INTEGER_BALANCE, MAX_INTEGER_BALANCE),
        fc.integer({ min: 1, max: 18 }),
        (balance, decimals) => {
          const shifted = new Big(getDecimalTokenBalance(balance, decimals)).times(10);
          const lowerDecimals = new Big(getDecimalTokenBalance(balance, decimals - 1));
          expect(shifted.toFixed()).toBe(lowerDecimals.toFixed());
        },
      ),
    );
  });
});

describe('getBlockchainAmount (property)', () => {
  it('matches the big.js reference', () => {
    fc.assert(
      fc.property(
        bigIntString(-MAX_INTEGER_BALANCE, MAX_INTEGER_BALANCE),
        fc.integer({ min: 0, max: 18 }),
        (balance, decimals) => {
          const decimalAmount = referenceToDecimal(balance, decimals);

          expect(getBlockchainAmount(decimalAmount, decimals)).toBe(
            referenceToRaw(decimalAmount, decimals),
          );
        },
      ),
    );
  });

  it('truncates a fraction longer than decimals instead of rounding up', () => {
    fc.assert(
      fc.property(
        bigIntString(1n, MAX_INTEGER_BALANCE),
        fc.integer({ min: 1, max: 18 }),
        fc.integer({ min: 1, max: 6 }),
        (integerPart, decimals, extraDigits) => {
          const decimalAmount = `${integerPart}.${'9'.repeat(decimals + extraDigits)}`;

          expect(getBlockchainAmount(decimalAmount, decimals)).toBe(
            `${integerPart}${'9'.repeat(decimals)}`,
          );
        },
      ),
    );
  });
});

describe('formatFiatBalance (property)', () => {
  const FIAT_DECIMALS = 2;

  it('falsy balance returns the default', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<undefined | 0 | ''>(undefined, 0, ''),
        fc.string({ minLength: 1, maxLength: 10 }),
        (falsy, defaultBalance) => {
          expect(formatFiatBalance(falsy as never, defaultBalance)).toBe(defaultBalance);
        },
      ),
    );
  });

  it('any truthy balance under a cent returns "<$0.01"', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1e-9, max: 0.00999, noNaN: true, noDefaultInfinity: true }),
        balance => {
          expect(formatFiatBalance(balance)).toBe('<$0.01');
        },
      ),
    );
  });

  it('balance >= 0.01 formats as "$<number>" and round-trips through Decimal', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 1e12, noNaN: true, noDefaultInfinity: true }),
        balance => {
          const out = formatFiatBalance(balance);
          expect(out.startsWith('$')).toBe(true);
          expect(out.includes('<')).toBe(false);
          const parsed = new Decimal(out.slice(1).replace(/,/g, ''));
          const expected = new Decimal(balance).toDecimalPlaces(FIAT_DECIMALS);
          expect(parsed.eq(expected)).toBe(true);
        },
      ),
    );
  });

  it('is deterministic', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1e12, noNaN: true, noDefaultInfinity: true }),
        balance => {
          expect(formatFiatBalance(balance)).toBe(formatFiatBalance(balance));
        },
      ),
    );
  });
});

describe('formatFiatAmountToTokenAmount (property)', () => {
  it('empty fiatAmount always returns "0"', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.0001, max: 1e6, noNaN: true, noDefaultInfinity: true }),
        rate => {
          expect(formatFiatAmountToTokenAmount('', rate)).toBe('0');
        },
      ),
    );
  });

  it('output has at most 1 decimal place', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1e9, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0.0001, max: 1e6, noNaN: true, noDefaultInfinity: true }),
        (fiat, rate) => {
          const out = formatFiatAmountToTokenAmount(String(fiat), rate);
          const dot = out.indexOf('.');
          if (dot >= 0) {
            expect(out.length - dot - 1).toBeLessThanOrEqual(1);
          }
        },
      ),
    );
  });

  it('output matches en-US number shape', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1e9, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0.0001, max: 1e6, noNaN: true, noDefaultInfinity: true }),
        (fiat, rate) => {
          const out = formatFiatAmountToTokenAmount(String(fiat), rate);
          expect(out).toMatch(/^-?\d{1,3}(,\d{3})*(\.\d)?$/);
        },
      ),
    );
  });

  it('parsed-back value equals the Decimal pipeline used internally', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1e9, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0.0001, max: 1e6, noNaN: true, noDefaultInfinity: true }),
        (fiat, rate) => {
          const out = formatFiatAmountToTokenAmount(String(fiat), rate);
          const parsed = new Decimal(out.replace(/,/g, ''));
          const expected = new Decimal(parseFloat(String(fiat) || '0'))
            .div(rate)
            .toDecimalPlaces(1);
          expect(parsed.eq(expected)).toBe(true);
        },
      ),
    );
  });
});
