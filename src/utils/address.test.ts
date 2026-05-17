import {
  formatAddress,
  isPublicKeyHash,
  renderShortAddress,
  renderSlightlyLongAddress,
} from './address';

const LONG_ADDR = '0106956df3aba7115e28271d053205ec7f33cab259f8e2da2f38150f0ece65a2a8';

describe('address utils', () => {
  describe('renderShortAddress', () => {
    it('shortens addresses longer than minLength', () => {
      expect(renderShortAddress(LONG_ADDR)).toBe(`${LONG_ADDR.slice(0, 5)}...${LONG_ADDR.slice(-5)}`);
    });

    it('returns the address unchanged when it is shorter than minLength', () => {
      expect(renderShortAddress('0123456789ab')).toBe('0123456789ab');
    });

    it('returns empty string for empty input', () => {
      expect(renderShortAddress('')).toBe('');
    });

    it('respects the chars argument', () => {
      expect(renderShortAddress(LONG_ADDR, 3)).toBe(
        `${LONG_ADDR.slice(0, 3)}...${LONG_ADDR.slice(-3)}`,
      );
    });
  });

  describe('renderSlightlyLongAddress', () => {
    it('shortens long addresses', () => {
      const out = renderSlightlyLongAddress(LONG_ADDR);
      expect(out).toContain('...');
      expect(out.startsWith(LONG_ADDR.slice(0, 20))).toBe(true);
      expect(out.endsWith(LONG_ADDR.slice(-4))).toBe(true);
    });

    it('returns the address unchanged when it is shorter than minLength', () => {
      expect(renderSlightlyLongAddress('012345')).toBe('012345');
    });

    it('returns empty string for empty input', () => {
      expect(renderSlightlyLongAddress('')).toBe('');
    });
  });

  describe('formatAddress', () => {
    it('uses short format by default', () => {
      expect(formatAddress(LONG_ADDR)).toBe(renderShortAddress(LONG_ADDR));
    });

    it('uses mid format when requested', () => {
      expect(formatAddress(LONG_ADDR, 'mid')).toBe(renderSlightlyLongAddress(LONG_ADDR));
    });

    it('returns the raw address for an unknown format', () => {
      expect(formatAddress(LONG_ADDR, 'full')).toBe(LONG_ADDR);
    });
  });

  describe('isPublicKeyHash', () => {
    it.each([
      ['01' + 'a'.repeat(64), true],
      ['02' + 'a'.repeat(66), true],
      ['ab' + 'a'.repeat(60), false],
      ['', false],
    ])('returns %s -> %s', (input, expected) => {
      expect(Boolean(isPublicKeyHash(input))).toBe(expected);
    });

    it('returns falsy for null/undefined', () => {
      expect(isPublicKeyHash(null)).toBeFalsy();
      expect(isPublicKeyHash(undefined)).toBeFalsy();
    });
  });
});
