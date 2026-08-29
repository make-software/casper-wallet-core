import {
  calculateApprovalAmount,
  calculateMaxAmountWithSlippage,
  calculateMinAmountWithSlippage,
  doesAmountExceedBalance,
  exceedsMaxDecimals,
  hasEnoughCSPRBalance,
  isAmountInputValid,
  isPositiveAmount,
} from './amounts';

describe('amounts', () => {
  describe('calculateMinAmountWithSlippage', () => {
    it('floors the min amount', () => {
      expect(calculateMinAmountWithSlippage('1000000000', 3)).toBe('970000000');
    });

    it('floors on fractional slippage', () => {
      expect(calculateMinAmountWithSlippage('1001', 0.3)).toBe('997');
    });

    it('keeps every digit of a balance wider than the default Decimal precision', () => {
      expect(calculateMinAmountWithSlippage('999999999999999999999', 0.5)).toBe(
        '994999999999999999999',
      );
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

  describe('isPositiveAmount', () => {
    it('rejects zero', () => {
      expect(isPositiveAmount('0')).toBe(false);
    });

    it('accepts a positive amount', () => {
      expect(isPositiveAmount('0.1')).toBe(true);
    });
  });

  describe('isAmountInputValid', () => {
    it('allows empty string', () => {
      expect(isAmountInputValid('')).toBe(true);
    });

    it('rejects too many decimals', () => {
      expect(isAmountInputValid('1.234', 2)).toBe(false);
    });

    it('rejects non-numeric input', () => {
      expect(isAmountInputValid('12a')).toBe(false);
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

  describe('hasEnoughCSPRBalance', () => {
    it('reports sufficient balance', () => {
      expect(hasEnoughCSPRBalance('100', '60', '40')).toBe(true);
    });

    it('reports insufficient balance', () => {
      expect(hasEnoughCSPRBalance('99', '60', '40')).toBe(false);
    });
  });
});
