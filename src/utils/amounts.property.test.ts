import Big from 'big.js';
import fc from 'fast-check';

import {
  calculateMaxAmountWithSlippage,
  calculateMinAmountWithSlippage,
  formattedToRaw,
  rawToFormatted,
} from './amounts';

// Parity tests: assert the decimal.js implementations match the big.js reference results
// bit-for-bit, so this math cannot silently change on-chain amounts. big.js is a devDependency
// used only here — shipped code never imports it.

const motes = () => fc.bigInt({ min: 0n, max: 10n ** 30n }).map(String);
const decimalsArb = () => fc.integer({ min: 0, max: 18 });
const slippageArb = () => fc.integer({ min: 1, max: 5000 }).map(n => n / 100);

const referenceRawToFormatted = (rawAmount: string, decimals: number) =>
  new Big(rawAmount).div(new Big(10).pow(decimals)).toFixed();

const referenceFormattedToRaw = (formattedAmount: string, decimals: number) =>
  new Big(formattedAmount).times(new Big(10).pow(decimals)).round(0, Big.roundDown).toFixed(0);

const referenceMin = (amount: string, slippage: number) =>
  new Big(amount).times(new Big(1).minus(new Big(slippage).div(100))).toFixed(0, Big.roundDown);

const referenceMax = (amount: string, slippage: number) =>
  new Big(amount).times(new Big(1).plus(new Big(slippage).div(100))).toFixed(0, Big.roundUp);

describe('amounts (big.js parity)', () => {
  it('rawToFormatted matches the big.js original', () => {
    fc.assert(
      fc.property(motes(), decimalsArb(), (rawAmount, decimals) => {
        expect(rawToFormatted(rawAmount, decimals)).toBe(
          referenceRawToFormatted(rawAmount, decimals),
        );
      }),
    );
  });

  it('formattedToRaw matches the big.js original', () => {
    fc.assert(
      fc.property(motes(), decimalsArb(), (rawAmount, decimals) => {
        // Derive a formatted amount from an already-verified conversion so the
        // fixture is always a valid decimal string for the given decimals.
        const formattedAmount = referenceRawToFormatted(rawAmount, decimals);

        expect(formattedToRaw(formattedAmount, decimals)).toBe(
          referenceFormattedToRaw(formattedAmount, decimals),
        );
      }),
    );
  });

  it('min slippage matches the big.js original', () => {
    fc.assert(
      fc.property(motes(), slippageArb(), (amount, slippage) => {
        expect(calculateMinAmountWithSlippage(amount, slippage)).toBe(
          referenceMin(amount, slippage),
        );
      }),
    );
  });

  it('max slippage matches the big.js original', () => {
    fc.assert(
      fc.property(motes(), slippageArb(), (amount, slippage) => {
        expect(calculateMaxAmountWithSlippage(amount, slippage)).toBe(
          referenceMax(amount, slippage),
        );
      }),
    );
  });
});
