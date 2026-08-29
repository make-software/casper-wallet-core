import {
  formatDeployDetailsTimestamp,
  formatTimestamp,
  formatTimestampAge,
  getCurrentTime,
  isAppEventActive,
  isExpired,
} from './date';
import type { IAppMarketingEvent } from '../domain';

const FROZEN_NOW = new Date('2024-06-15T12:00:00.000Z');

describe('date utils', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(FROZEN_NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('formatTimestamp', () => {
    it('formats a timestamp using en locale', () => {
      const out = formatTimestamp('2024-01-15T10:30:00.000Z');
      expect(typeof out).toBe('string');
      expect(out).toMatch(/2024/);
      expect(out).toMatch(/Jan/);
    });

    it('accepts custom Intl options', () => {
      const out = formatTimestamp('2024-01-15T10:30:00.000Z', 'en', { year: '2-digit' });
      expect(out).toMatch(/24/);
    });
  });

  describe('formatDeployDetailsTimestamp', () => {
    it('returns "<date>, <time>" with AM/PM', () => {
      const out = formatDeployDetailsTimestamp('2024-01-15T10:30:00.000Z');
      expect(out).toContain(',');
      expect(out).toMatch(/(AM|PM)/);
    });
  });

  describe('formatTimestampAge', () => {
    it('returns a relative-time string for past dates', () => {
      const out = formatTimestampAge('2024-06-15T11:00:00.000Z');
      expect(out).toMatch(/ago/);
    });

    it('returns a relative-time string for future dates', () => {
      const out = formatTimestampAge('2024-06-15T13:00:00.000Z');
      expect(out).toMatch(/in/);
    });
  });

  describe('getCurrentTime', () => {
    it('returns HH:MM:SS', () => {
      expect(getCurrentTime()).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    });
  });

  describe('isExpired', () => {
    it('treats undefined as expired', () => {
      expect(isExpired(undefined)).toBe(true);
    });

    it('returns true for past dates', () => {
      expect(isExpired('2020-01-01T00:00:00.000Z')).toBe(true);
    });

    it('returns false for future dates', () => {
      expect(isExpired('2099-01-01T00:00:00.000Z')).toBe(false);
    });
  });

  describe('isAppEventActive', () => {
    const evt = (overrides: Partial<IAppMarketingEvent>): IAppMarketingEvent =>
      ({
        id: 1,
        name: 'evt',
        description: '',
        startAt: '2024-01-01T00:00:00.000Z',
        endAt: '2099-01-01T00:00:00.000Z',
        url: '',
        imageUrl: null,
        ...overrides,
      }) as IAppMarketingEvent;

    it('returns true when between start and end', () => {
      expect(isAppEventActive(evt({}))).toBe(true);
    });

    it('returns false when before start', () => {
      expect(isAppEventActive(evt({ startAt: '2099-01-01T00:00:00.000Z' }))).toBe(false);
    });

    it('returns false when after end', () => {
      expect(isAppEventActive(evt({ endAt: '2020-01-01T00:00:00.000Z' }))).toBe(false);
    });

    it('returns true past start when no endAt provided', () => {
      expect(isAppEventActive(evt({ endAt: null }))).toBe(true);
    });

    it('returns true for startAt=null because Date(null) → 1970 < now', () => {
      // The function only throws if construction throws; Date(null) is the epoch, not invalid.
      expect(
        isAppEventActive({ startAt: null as unknown as string, endAt: null } as IAppMarketingEvent),
      ).toBe(true);
    });
  });
});
