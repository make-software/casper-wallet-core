import {
  calculateApprovalAmount,
  calculateMaxAmountWithSlippage,
  calculateMinAmountWithSlippage,
  calculatePercentageOf,
  calculateTotalCSPRRequired,
  clampAmountToDecimals,
  doesAmountExceedBalance,
  exceedsMaxDecimals,
  formattedToRaw,
  formattedToRawSafe,
  getSlippageNumberFromInput,
  hasEnoughCSPRBalance,
  isAmountValid,
  isValidAmount,
  isValidContractPackageHash,
  rawToFormatted,
} from './amounts';

describe('amounts', () => {
  describe('rawToFormatted', () => {
    it('converts raw to formatted', () => {
      expect(rawToFormatted('1500000000', 9)).toBe('1.5');
    });

    it('throws on empty rawAmount', () => {
      expect(() => rawToFormatted('', 9)).toThrow('rawAmount cannot be empty');
    });

    it('throws on invalid decimals', () => {
      expect(() => rawToFormatted('1', -1)).toThrow('decimals must be a non-negative integer');
    });
  });

  describe('formattedToRaw', () => {
    it('converts formatted to raw', () => {
      expect(formattedToRaw('1.5', 9)).toBe('1500000000');
    });

    it('rounds down', () => {
      expect(formattedToRaw('0.0000000015', 9)).toBe('1');
    });
  });

  describe('formattedToRawSafe', () => {
    it('swallows errors and returns the fallback', () => {
      expect(formattedToRawSafe('abc', 9)).toBe('0');
    });
  });

  describe('calculateMinAmountWithSlippage', () => {
    it('floors the min amount', () => {
      expect(calculateMinAmountWithSlippage('1000000000', 3)).toBe('970000000');
    });

    it('floors on fractional slippage', () => {
      expect(calculateMinAmountWithSlippage('1001', 0.3)).toBe('997');
    });
  });

  describe('calculateMaxAmountWithSlippage', () => {
    it('ceils on fractional slippage', () => {
      expect(calculateMaxAmountWithSlippage('1001', 0.3)).toBe('1005');
    });

    it('ceils the max amount', () => {
      expect(calculateMaxAmountWithSlippage('1000000000', 3)).toBe('1030000000');
    });
  });

  describe('calculatePercentageOf', () => {
    it('computes the percentage', () => {
      expect(calculatePercentageOf('1000', '0.3')).toBe('3');
    });
  });

  describe('getSlippageNumberFromInput', () => {
    it('accepts a comma as decimal separator', () => {
      expect(getSlippageNumberFromInput('1,5')).toBe(1.5);
    });

    it('truncates to 2 decimal places', () => {
      expect(getSlippageNumberFromInput('1.239')).toBe(1.23);
    });

    it('returns 0 for junk input without throwing', () => {
      expect(getSlippageNumberFromInput('abc')).toBe(0);
    });
  });

  describe('isValidAmount', () => {
    it('rejects zero', () => {
      expect(isValidAmount('0')).toBe(false);
    });

    it('accepts a positive amount', () => {
      expect(isValidAmount('0.1')).toBe(true);
    });
  });

  describe('isAmountValid', () => {
    it('allows empty string', () => {
      expect(isAmountValid('')).toBe(true);
    });

    it('rejects too many decimals', () => {
      expect(isAmountValid('1.234', 2)).toBe(false);
    });

    it('rejects non-numeric input', () => {
      expect(isAmountValid('12a')).toBe(false);
    });
  });

  describe('clampAmountToDecimals', () => {
    it('clamps the fraction part', () => {
      expect(clampAmountToDecimals('1.23456', 2)).toBe('1.23');
    });

    it('drops the fraction entirely for 0 decimals', () => {
      expect(clampAmountToDecimals('5.', 0)).toBe('5');
    });
  });

  describe('doesAmountExceedBalance', () => {
    it('detects the amount exceeding the balance', () => {
      expect(doesAmountExceedBalance('5', '4')).toBe(true);
    });

    it('returns false for empty amount', () => {
      expect(doesAmountExceedBalance('', '4')).toBe(false);
    });

    it('returns false for invalid amount', () => {
      expect(doesAmountExceedBalance('abc', '4')).toBe(false);
    });
  });

  describe('exceedsMaxDecimals', () => {
    it('detects too many decimals', () => {
      expect(exceedsMaxDecimals('1.234', 2)).toBe(true);
    });

    it('accepts decimals within the limit', () => {
      expect(exceedsMaxDecimals('1.23', 2)).toBe(false);
    });
  });

  describe('calculateApprovalAmount', () => {
    it('adds a 20% buffer over the balance', () => {
      expect(calculateApprovalAmount('1000000000')).toBe('1200000000');
    });

    it('returns 0 for an empty or zero balance', () => {
      expect(calculateApprovalAmount('')).toBe('0');
      expect(calculateApprovalAmount('0')).toBe('0');
    });

    it('truncates like the integer math it replaces', () => {
      // (BigInt(x) * 120n) / 100n for the same inputs
      expect(calculateApprovalAmount('7')).toBe('8');
      expect(calculateApprovalAmount('1')).toBe('1');
    });
  });

  describe('CSPR total & sufficiency', () => {
    it('sums amount and fee', () => {
      expect(calculateTotalCSPRRequired('60', '40')).toBe('100');
    });

    it('reports sufficient balance', () => {
      expect(hasEnoughCSPRBalance('100', '60', '40')).toBe(true);
    });

    it('reports insufficient balance', () => {
      expect(hasEnoughCSPRBalance('99', '60', '40')).toBe(false);
    });
  });

  describe('isValidContractPackageHash', () => {
    it('accepts 64 hex characters', () => {
      expect(isValidContractPackageHash('a'.repeat(64))).toBe(true);
    });

    it('rejects a hash- prefixed value', () => {
      expect(isValidContractPackageHash(`hash-${'a'.repeat(64)}`)).toBe(false);
    });
  });
});
