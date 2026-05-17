import { OnRampRepository } from './index';
import { createMockHttpProvider } from '../../../__test-utils__';
import { OnRampError } from '../../../domain';

describe('OnRampRepository', () => {
  describe('getOnRampCountriesAndCurrencies', () => {
    it('returns OnRampDto on success', async () => {
      const http = createMockHttpProvider();
      http.get.mockResolvedValueOnce({
        countries: [],
        defaultCountry: 'US',
        currencies: [],
        defaultCurrency: 'USD',
        defaultAmount: '100',
      });
      const repo = new OnRampRepository(http);

      const out = await repo.getOnRampCountriesAndCurrencies();
      expect(out.defaultCountry).toBe('US');
    });

    it('wraps errors in OnRampError', async () => {
      const http = createMockHttpProvider();
      http.get.mockRejectedValueOnce(new Error('fail'));
      const repo = new OnRampRepository(http);

      await expect(repo.getOnRampCountriesAndCurrencies()).rejects.toBeInstanceOf(OnRampError);
    });
  });

  describe('getOnRampProviders', () => {
    it('returns OnRampProvidersDto on success', async () => {
      const http = createMockHttpProvider();
      http.post.mockResolvedValueOnce({
        availableProviders: [],
        currencies: [{ id: 'USD' }],
        fiatAmount: 100,
        cryptoAmount: 1000,
        cryptoCurrency: 'CSPR',
        isCryptoChanged: false,
        fiatCurrency: 'USD',
      });
      const repo = new OnRampRepository(http);

      const out = await repo.getOnRampProviders({
        cryptoCurrency: 'CSPR',
        fiatCurrency: 'USD',
        fiatAmount: '100',
        country: 'US',
      } as never);
      expect(out.cryptoCurrency).toBe('CSPR');
    });
  });

  describe('getProviderLocation', () => {
    it('returns response', async () => {
      const http = createMockHttpProvider();
      http.post.mockResolvedValueOnce({ location: 'https://x', provider: 'p' });
      const repo = new OnRampRepository(http);
      const out = await repo.getProviderLocation({} as never);
      expect(out.location).toBe('https://x');
    });

    it('returns empty defaults when API returns nothing', async () => {
      const http = createMockHttpProvider();
      http.post.mockResolvedValueOnce(undefined);
      const repo = new OnRampRepository(http);
      expect(await repo.getProviderLocation({} as never)).toEqual({ location: '', provider: '' });
    });
  });
});
