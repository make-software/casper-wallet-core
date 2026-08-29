import Decimal from 'decimal.js';

export const AmountDecimal = Decimal.clone({ precision: 50, toExpNeg: -50, toExpPos: 50 });

/** `value * 10 ^ exponent`, exact for an input of any size. */
export const shiftDecimal = (value: Decimal.Value, exponent: number): Decimal =>
  new Decimal(`${new Decimal(value).toFixed()}e${exponent}`);
