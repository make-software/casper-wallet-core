import { AppEventsRepository } from './index';
import { createMockHttpProvider, makeMarketingEvent, makeReleaseEvent } from '../../../__test-utils__';
import { AppEventsError, CasperWalletApiByEnvUrl } from '../../../domain';

describe('AppEventsRepository', () => {
  describe('getReleaseEvents', () => {
    it('returns mapped release events', async () => {
      const http = createMockHttpProvider();
      http.get.mockResolvedValueOnce({ data: [makeReleaseEvent()] });
      const repo = new AppEventsRepository(http, CasperWalletApiByEnvUrl);

      const out = await repo.getReleaseEvents({ currentVersion: '1.1.0' });
      expect(out).toHaveLength(1);
      expect(out[0].version).toBe('1.2.0');
    });

    it('wraps errors in AppEventsError', async () => {
      const http = createMockHttpProvider();
      http.get.mockRejectedValueOnce(new Error('fail'));
      const repo = new AppEventsRepository(http, CasperWalletApiByEnvUrl);

      await expect(repo.getReleaseEvents({ currentVersion: '1.0.0' })).rejects.toBeInstanceOf(
        AppEventsError,
      );
    });
  });

  describe('getMarketingEvents', () => {
    it('returns mapped marketing events', async () => {
      const http = createMockHttpProvider();
      http.get.mockResolvedValueOnce({ data: [makeMarketingEvent()] });
      const repo = new AppEventsRepository(http, CasperWalletApiByEnvUrl);

      const out = await repo.getMarketingEvents();
      expect(out).toHaveLength(1);
      expect(out[0].id).toBe(42);
    });

    it('returns empty when API returns nothing', async () => {
      const http = createMockHttpProvider();
      http.get.mockResolvedValueOnce(undefined);
      const repo = new AppEventsRepository(http, CasperWalletApiByEnvUrl);

      expect(await repo.getMarketingEvents()).toEqual([]);
    });
  });

  describe('getActiveMarketingEvent', () => {
    it('returns the first active, non-ignored event', async () => {
      const http = createMockHttpProvider();
      const past = makeMarketingEvent({ id: 1 });
      const ignored = makeMarketingEvent({ id: 2 });
      http.get.mockResolvedValueOnce({ data: [past, ignored] });
      const repo = new AppEventsRepository(http, CasperWalletApiByEnvUrl);

      const out = await repo.getActiveMarketingEvent({
        env: 'PRODUCTION',
        withProxyHeader: true,
        ignoreEventIds: [2],
      });
      expect(out!.id).toBe(1);
    });

    it('returns null when none active', async () => {
      const http = createMockHttpProvider();
      const inactive = makeMarketingEvent({ start_at: '2099-01-01T00:00:00.000Z' });
      http.get.mockResolvedValueOnce({ data: [inactive] });
      const repo = new AppEventsRepository(http, CasperWalletApiByEnvUrl);

      const out = await repo.getActiveMarketingEvent({
        env: 'PRODUCTION',
        withProxyHeader: true,
        ignoreEventIds: [],
      });
      expect(out).toBeNull();
    });
  });
});
