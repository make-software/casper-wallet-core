import { LedgerError, LedgerEventStatus } from '../domain/ledger';
import type { IDexToken } from '../domain/swap/entities';
import { SwapQuoteType } from '../domain/swap/entities';
import {
  calculateMaxUsableBalance,
  calculateSwapFee,
  calculateSwapMaxSlippage,
  calculateSwapPaymentAmount,
  calculateSwapRate,
  calculateTokenFiatAmount,
  clampDeadlineValue,
  clampSlippageValue,
  getErrorMessageDescription,
  getMillisecondsUntilNextBlock,
  getSwapRoutes,
  getTransactionErrorMessage,
  handleTokenSelection,
} from './swap';

const WCSPR_HASH = '1111111111111111111111111111111111111111111111111111111111111111'.slice(0, 64);

const buildToken = (overrides: Partial<IDexToken> = {}): IDexToken => ({
  id: 'some-package-hash',
  name: 'Some Token',
  symbol: 'TOK',
  icon: null,
  decimals: 9,
  packageHash: 'some-package-hash',
  isWhitelisted: true,
  isBlacklisted: false,
  fiatRates: null,
  totalValueLocked: null,
  volume24h: null,
  ...overrides,
});

const csprToken = buildToken({
  id: 'cspr',
  name: 'Casper',
  symbol: 'CSPR',
  packageHash: WCSPR_HASH,
  decimals: 9,
});

describe('swap', () => {
  describe('calculateSwapRate', () => {
    it('computes the rate for ExactIn', () => {
      expect(calculateSwapRate('2000000000', 9, '1000000000', 9, SwapQuoteType.ExactIn)).toBe(
        '0.5',
      );
    });

    it('computes the rate for ExactOut', () => {
      expect(calculateSwapRate('2000000000', 9, '1000000000', 9, SwapQuoteType.ExactOut)).toBe('2');
    });
  });

  describe('calculateSwapFee', () => {
    it('defaults to the 0.3% protocol fee', () => {
      expect(calculateSwapFee('1000')).toBe('3');
    });

    it('returns "0" for empty input', () => {
      expect(calculateSwapFee('')).toBe('0');
    });
  });

  describe('calculateSwapMaxSlippage', () => {
    it('converts bps to a percentage string', () => {
      expect(calculateSwapMaxSlippage('50')).toBe('0.50');
    });

    it('returns null when slippageBps is undefined', () => {
      expect(calculateSwapMaxSlippage(undefined)).toBeNull();
    });
  });

  describe('getMillisecondsUntilNextBlock', () => {
    it('computes the remaining time until the next block', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:03.000Z'));

      const lastBlockTimestamp = new Date('2026-01-01T00:00:00.000Z').getTime();

      expect(getMillisecondsUntilNextBlock(lastBlockTimestamp)).toBe(5500);

      jest.useRealTimers();
    });
  });

  describe('getSwapRoutes', () => {
    it('displays the WCSPR leg as the synthetic native CSPR token by default', () => {
      expect(getSwapRoutes([WCSPR_HASH], [csprToken], WCSPR_HASH)).toEqual([csprToken]);
    });

    it('displays the WCSPR leg as itself when wcsprDisplay is "wrapped"', () => {
      const [route] = getSwapRoutes([WCSPR_HASH], [csprToken], WCSPR_HASH, {
        wcsprDisplay: 'wrapped',
      });

      expect(route).toMatchObject({ id: WCSPR_HASH, symbol: 'WCSPR', name: 'Wrapped Casper' });
    });

    it('filters out hashes that have no matching token', () => {
      expect(getSwapRoutes(['unknown-hash'], [csprToken], WCSPR_HASH)).toEqual([]);
    });

    it('matches token package hashes case-insensitively', () => {
      const token = buildToken({ id: 'abc', packageHash: 'ABCDEF' });

      expect(getSwapRoutes(['abcdef'], [token], WCSPR_HASH)).toEqual([token]);
    });
  });

  describe('getErrorMessageDescription', () => {
    it('maps known error codes to copy', () => {
      expect(getErrorMessageDescription('not_found')).toBe(
        'Please select a different trading pair.',
      );
      expect(getErrorMessageDescription('invalid_input')).toBe(
        'Please provide a higher input amount for a trade.',
      );
    });

    it('returns null when code is missing', () => {
      expect(getErrorMessageDescription(null)).toBeNull();
    });
  });

  describe('calculateTokenFiatAmount', () => {
    it('returns "" when the token is null', () => {
      expect(calculateTokenFiatAmount(null, '1', 'USD')).toBe('');
    });

    it('uses csprFiatRate for the native CSPR token', () => {
      expect(calculateTokenFiatAmount(csprToken, '100', 'USD', null, 0.05)).toBe('$5.00');
    });

    it('shows a sub-cent amount as a bound', () => {
      const token = buildToken();

      expect(calculateTokenFiatAmount(token, '0.005', 'USD', 1)).toBe('<$0.01');
    });

    it('shows the bound in the requested currency', () => {
      const token = buildToken();

      expect(calculateTokenFiatAmount(token, '', 'EUR', 1)).toBe('<€0.01');
    });

    it('returns "N/A" when there is no fiat rate', () => {
      const token = buildToken();

      expect(calculateTokenFiatAmount(token, '1', 'USD', null)).toBe('N/A');
    });
  });

  describe('calculateSwapPaymentAmount', () => {
    it('returns null if either token is null', () => {
      expect(calculateSwapPaymentAmount(null, buildToken(), null, 'USD')).toBeNull();
      expect(calculateSwapPaymentAmount(csprToken, null, null, 'USD')).toBeNull();
    });

    it('falls back to "30 CSPR" when there is no fiat rate', () => {
      expect(calculateSwapPaymentAmount(csprToken, buildToken(), null, 'USD')).toBe('30 CSPR');
    });

    it('converts to fiat when a csprFiatRate is given', () => {
      const token1 = buildToken({ id: 'a', packageHash: 'a' });
      const token2 = buildToken({ id: 'b', packageHash: 'b' });

      expect(calculateSwapPaymentAmount(token1, token2, 0.1, 'USD')).toBe('$3.00');
    });
  });

  describe('calculateMaxUsableBalance', () => {
    it('returns the input balance for non-CSPR tokens', () => {
      expect(calculateMaxUsableBalance({ balance: '12.5', symbol: 'TOK', context: 'swap' })).toBe(
        '12.5',
      );
    });

    it('reserves approve + swap CSPR for the swap context', () => {
      expect(calculateMaxUsableBalance({ balance: '100', symbol: 'CSPR', context: 'swap' })).toBe(
        '65',
      );
    });

    it('floors at "0" when the reserve exceeds the balance in the swap context', () => {
      expect(calculateMaxUsableBalance({ balance: '30', symbol: 'CSPR', context: 'swap' })).toBe(
        '0',
      );
    });

    it('reserves the wrap payment for the wrap context', () => {
      expect(calculateMaxUsableBalance({ balance: '100', symbol: 'CSPR', context: 'wrap' })).toBe(
        '95',
      );
    });

    it('floors at "0" when the reserve exceeds the balance in the wrap context', () => {
      expect(calculateMaxUsableBalance({ balance: '5', symbol: 'CSPR', context: 'wrap' })).toBe(
        '0',
      );
    });
  });

  describe('getTransactionErrorMessage', () => {
    it('extracts the message from an Error instance', () => {
      expect(getTransactionErrorMessage(new Error('boom'))).toBe('boom');
    });

    it('returns a bare string as-is', () => {
      expect(getTransactionErrorMessage('bare message')).toBe('bare message');
    });

    it('extracts message from a plain object', () => {
      expect(getTransactionErrorMessage({ message: 'plain object message' })).toBe(
        'plain object message',
      );
    });

    it('falls back to the default message', () => {
      expect(getTransactionErrorMessage({})).toBe('Transaction failed');
    });

    it('falls back to a custom fallback', () => {
      expect(getTransactionErrorMessage({}, 'Custom fallback')).toBe('Custom fallback');
    });

    it('renders a LedgerError as its device status, never its JSON payload', () => {
      const error = new LedgerError({
        status: LedgerEventStatus.SignatureCanceled,
        publicKey: '02abc',
        txHash: 'deadbeef',
      } as never);

      expect(getTransactionErrorMessage(error)).toBe(LedgerEventStatus.SignatureCanceled);
      expect(getTransactionErrorMessage(error)).not.toContain('02abc');
    });
  });

  describe('handleTokenSelection', () => {
    it('swaps positions when selecting the token already in the other slot', () => {
      const first = buildToken({ id: 'first', packageHash: 'first' });
      const second = buildToken({ id: 'second', packageHash: 'second' });

      // `first` is already selected in the 'first' slot; picking it for 'second' should
      // swap the two positions rather than duplicate the token.
      expect(handleTokenSelection({ first, second }, first, 'second')).toEqual({
        first: second,
        second: first,
      });
    });

    it('sets the token in the current position otherwise', () => {
      const first = buildToken({ id: 'first', packageHash: 'first' });
      const second = buildToken({ id: 'second', packageHash: 'second' });

      expect(handleTokenSelection({ first: null, second: null }, first, 'first')).toEqual({
        first,
        second: null,
      });
      expect(handleTokenSelection({ first, second: null }, second, 'second')).toEqual({
        first,
        second,
      });
    });
  });

  describe('clampSlippageValue', () => {
    it('clamps to the [0.01, 50] range', () => {
      expect(clampSlippageValue(0.001)).toBe(0.01);
      expect(clampSlippageValue(51)).toBe(50);
      expect(clampSlippageValue(NaN)).toBe(0.01);
    });
  });

  describe('clampDeadlineValue', () => {
    it('clamps to the [1, 120] range', () => {
      expect(clampDeadlineValue(0)).toBe(1);
      expect(clampDeadlineValue(121)).toBe(120);
      expect(clampDeadlineValue(NaN)).toBe(1);
    });
  });
});
