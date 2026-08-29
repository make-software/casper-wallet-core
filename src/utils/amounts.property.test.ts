import Big from 'big.js';
import fc from 'fast-check';

import { calculateMaxAmountWithSlippage, calculateMinAmountWithSlippage } from './amounts';

// Parity tests: assert the decimal.js implementations match the big.js reference results
// bit-for-bit, so this math cannot silently change on-chain amounts. big.js is a devDependency
// used only here — shipped code never imports it.

const motes = () => fc.bigInt({ min: 0n, max: 10n ** 30n }).map(String);
const slippageArb = () => fc.integer({ min: 1, max: 5000 }).map(n => n / 100);

const referenceMin = (amount: string, slippage: number) =>
  new Big(amount).times(new Big(1).minus(new Big(slippage).div(100))).toFixed(0, Big.roundDown);

const referenceMax = (amount: string, slippage: number) =>
  new Big(amount).times(new Big(1).plus(new Big(slippage).div(100))).toFixed(0, Big.roundUp);

describe('amounts (big.js parity)', () => {
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
