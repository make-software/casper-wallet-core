import { Maybe } from '../../typings';

export interface IDexToken {
  readonly id: string; // contract package hash, or the literal 'cspr' for the synthetic native token
  readonly name: string;
  readonly symbol: string;
  readonly icon: Maybe<string>;
  readonly decimals: number;
  readonly packageHash: string;
  readonly isWhitelisted: boolean;
  readonly isBlacklisted: boolean;
  readonly fiatRates: Maybe<number>;
  readonly totalValueLocked: Maybe<string>;
  readonly volume24h: Maybe<string>;
}

export type IDexTokenWithAmount = IDexToken & {
  amountFormatted: string;
  amountRaw: string;
  fiatAmount?: string;
};

export enum SwapQuoteType {
  ExactIn = 1,
  ExactOut = 2,
}

export interface ISwapQuote {
  readonly amountIn: string;
  readonly amountOut: string;
  readonly executionPrice: string;
  readonly midPrice: string;
  readonly path: string[];
  readonly priceImpact: string;
  readonly recommendedSlippageBps: string;
  readonly typeId: SwapQuoteType;
  readonly amountInDecimal: string; // derived client-side, not an API field
  readonly amountOutDecimal: string; // derived client-side
  readonly rate: string; // derived client-side
}

export enum FetchQuoteErrorCodes {
  InvalidAmount = 'invalid_input',
  NotFound = 'not_found',
}
