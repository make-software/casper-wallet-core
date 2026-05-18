import fc from 'fast-check';
import Decimal from 'decimal.js';

import { formatFiatAmountToTokenAmount, formatFiatBalance, getDecimalTokenBalance } from './common';

const bigIntString = (min: bigint, max: bigint) => fc.bigInt({ min, max }).map(String);

// decimal.js defaults to 20 significant digits of precision. Bounding integer
// balances to 10^18 keeps every value well inside that limit so round-trip
// equality holds without precision loss.
const MAX_INTEGER_BALANCE = 10n ** 18n;

describe('getDecimalTokenBalance (property)', () => {
  it('round-trip: result * 10^decimals === balance', () => {
    fc.assert(
      fc.property(
        bigIntString(-MAX_INTEGER_BALANCE, MAX_INTEGER_BALANCE),
        fc.integer({ min: 0, max: 18 }),
        (balance, decimals) => {
          const result = getDecimalTokenBalance(balance, decimals);
          const restored = new Decimal(result).mul(new Decimal(10).pow(decimals));
          expect(restored.eq(new Decimal(balance))).toBe(true);
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
          expect(new Decimal(positive).isPositive()).toBe(true);
          expect(negative.startsWith('-')).toBe(true);
          expect(new Decimal(negative).neg().eq(new Decimal(positive))).toBe(true);
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
          const shifted = new Decimal(getDecimalTokenBalance(balance, decimals)).mul(10);
          const lowerDecimals = new Decimal(getDecimalTokenBalance(balance, decimals - 1));
          expect(shifted.eq(lowerDecimals)).toBe(true);
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

  it('truthy balance rounding below 0.01 returns "<$0.01"', () => {
    fc.assert(
      fc.property(
        // (0, 0.005) — Decimal.js HALF_UP at 2 places rounds these to 0.00, so amount < 0.01.
        fc.double({ min: 1e-9, max: 0.00499, noNaN: true, noDefaultInfinity: true }),
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
