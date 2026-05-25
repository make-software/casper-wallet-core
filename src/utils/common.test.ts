import {
  capitalizeFirstLetter,
  delay,
  formatFiatAmount,
  formatFiatAmountToTokenAmount,
  formatFiatBalance,
  formatNetworkShare,
  formatNumber,
  formatTokenBalance,
  getBlockchainAmount,
  getCep18FiatAmount,
  getDecimalTokenBalance,
  getFiatAmount,
  getUniqueId,
  isHighStakeValidator,
  isKeysEqual,
  isNotEmpty,
  noop,
} from './common';

describe('common utils', () => {
  describe('noop', () => {
    it('returns undefined', () => {
      expect(noop()).toBeUndefined();
    });
  });

  describe('capitalizeFirstLetter', () => {
    it('capitalizes the first character', () => {
      expect(capitalizeFirstLetter('hello')).toBe('Hello');
    });

    it('handles empty string', () => {
      expect(capitalizeFirstLetter('')).toBe('');
    });
  });

  describe('formatFiatBalance', () => {
    it('returns default for missing balance', () => {
      expect(formatFiatBalance(undefined)).toBe('$0.00');
    });

    it('returns "<$0.01" for zero (because zero is < 0.01)', () => {
      expect(formatFiatBalance('0')).toBe('<$0.01');
    });

    it('returns <$0.01 for tiny amounts', () => {
      expect(formatFiatBalance('0.001')).toBe('<$0.01');
    });

    it('formats normal amounts with US grouping', () => {
      expect(formatFiatBalance('1234.5')).toBe('$1,234.5');
    });
  });

  describe('getDecimalTokenBalance', () => {
    it('divides raw balance by 10^decimals', () => {
      expect(getDecimalTokenBalance('1000000000', 9)).toBe('1');
      expect(getDecimalTokenBalance('1234500000', 9)).toBe('1.2345');
    });

    it('handles 0', () => {
      expect(getDecimalTokenBalance('0', 9)).toBe('0');
    });
  });

  describe('formatTokenBalance', () => {
    it('returns the default when the balance is empty or NaN', () => {
      expect(formatTokenBalance('', 9)).toBe('0');
      expect(formatTokenBalance('not-a-number', 9)).toBe('0');
    });

    it('floors at the configured display precision', () => {
      // 1.99999999 CSPR ⇒ should not round up beyond 5 fractional digits
      expect(formatTokenBalance('1999999999', 9)).toBe('1.99999');
    });

    it('respects isDecimalBalance flag', () => {
      expect(formatTokenBalance('1.234', 9, 5, '0', true)).toBe('1.234');
    });
  });

  describe('formatFiatAmountToTokenAmount', () => {
    it('divides fiat by rate', () => {
      expect(formatFiatAmountToTokenAmount('100', 2)).toBe('50');
    });

    it('handles empty fiat amount as zero', () => {
      expect(formatFiatAmountToTokenAmount('', 2)).toBe('0');
    });
  });

  describe('getUniqueId', () => {
    it('returns a UUID-shaped string', () => {
      expect(getUniqueId()).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('returns a different value each call', () => {
      expect(getUniqueId()).not.toBe(getUniqueId());
    });
  });

  describe('delay', () => {
    it('resolves after the specified time', async () => {
      const start = Date.now();
      await delay(20);
      expect(Date.now() - start).toBeGreaterThanOrEqual(15);
    });

    it('passes callback result through', async () => {
      const result = await delay(5, () => 'done');
      expect(result).toBe('done');
    });
  });

  describe('isKeysEqual', () => {
    it('returns true for keys with different case but same hex', () => {
      expect(isKeysEqual('0102AB', '0102ab')).toBe(true);
    });

    it('returns false when either side is missing', () => {
      expect(isKeysEqual(undefined, 'a')).toBe(false);
      expect(isKeysEqual('a', null)).toBe(false);
    });

    it('returns false for different keys', () => {
      expect(isKeysEqual('aaa', 'bbb')).toBe(false);
    });
  });

  describe('getBlockchainAmount', () => {
    it('multiplies by 10^decimals and returns an integer string', () => {
      expect(getBlockchainAmount('1', 9)).toBe('1000000000');
      expect(getBlockchainAmount('2.5', 9)).toBe('2500000000');
    });

    it('throws on invalid amount', () => {
      expect(() => getBlockchainAmount('not-a-number', 9)).toThrow();
    });
  });

  describe('formatFiatAmount', () => {
    it('multiplies CSPR rate × balance', () => {
      expect(formatFiatAmount(0.05, '100')).toBe('$5');
    });

    it('returns empty string for huge amounts (>= 10^9)', () => {
      expect(formatFiatAmount(100_000_000, '100')).toBe('');
    });
  });

  describe('formatNumber', () => {
    it('formats with precision', () => {
      expect(formatNumber('1.2345', { precision: { max: 2 } })).toBe('1.23');
    });

    it('supports short compact display', () => {
      const out = formatNumber('1234567', { compactDisplay: 'short' });
      expect(out).toContain(',');
    });
  });

  describe('getFiatAmount', () => {
    it('multiplies token by rate', () => {
      expect(getFiatAmount(2, 0.5)).toBe('$1');
    });

    it('defaults rate to 0 (returns <$0.01 since 10 × 0 = 0)', () => {
      expect(getFiatAmount(10)).toBe('<$0.01');
    });
  });

  describe('isNotEmpty', () => {
    it('returns true for truthy values', () => {
      expect(isNotEmpty('a')).toBe(true);
      expect(isNotEmpty(1)).toBe(true);
    });

    it('returns false for falsy values', () => {
      expect(isNotEmpty(undefined)).toBe(false);
      expect(isNotEmpty(null)).toBe(false);
      expect(isNotEmpty(0)).toBe(false);
      expect(isNotEmpty('')).toBe(false);
    });
  });

  describe('getCep18FiatAmount', () => {
    it('returns empty when rate is zero or missing', () => {
      expect(getCep18FiatAmount('1', 0)).toBe('');
      expect(getCep18FiatAmount('1')).toBe('');
    });

    it('returns raw decimal when not formatted', () => {
      expect(getCep18FiatAmount('10', 0.05, false)).toBe('0.5');
    });

    it('returns formatted fiat when requested', () => {
      expect(getCep18FiatAmount('10', 0.05, true)).toBe('$0.5');
    });
  });

  describe('isHighStakeValidator', () => {
    it('returns true when networkShare >= threshold (5)', () => {
      expect(isHighStakeValidator({ networkShare: '5' })).toBe(true);
      expect(isHighStakeValidator({ networkShare: '10' })).toBe(true);
    });

    it('returns false when networkShare < threshold', () => {
      expect(isHighStakeValidator({ networkShare: '4.99' })).toBe(false);
    });

    it('returns false when networkShare is null/NaN', () => {
      expect(isHighStakeValidator({ networkShare: null })).toBe(false);
      expect(isHighStakeValidator({ networkShare: 'NaN' })).toBe(false);
    });
  });

  describe('formatNetworkShare', () => {
    it('formats with 2 decimal places', () => {
      expect(formatNetworkShare('3.45678')).toBe('3.46');
    });

    it('returns null for null/NaN', () => {
      expect(formatNetworkShare(null)).toBeNull();
      expect(formatNetworkShare('NaN')).toBeNull();
    });
  });
});
