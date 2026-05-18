import { TokensRepository } from './index';
import {
  createMockHttpProvider,
  makeCsprBalanceResponse,
  makeCurrencyRateResponse,
  makeErc20Token,
} from '../../../__test-utils__';
import {
  CasperWalletApiByNetworkUrl,
  CSPR_API_PROXY_HEADERS,
  HttpClientNotFoundError,
  TokensError,
} from '../../../domain';

const PUBLIC_KEY = '0106956df3aba7115e28271d053205ec7f33cab259f8e2da2f38150f0ece65a2a8';

describe('TokensRepository', () => {
  describe('getTokens', () => {
    it('calls the cloud API and maps each token via TokenDto', async () => {
      const http = createMockHttpProvider();
      http.get.mockResolvedValueOnce({
        data: [makeErc20Token(), makeErc20Token({ contract_package_hash: 'cph-2' } as never)],
      });
      const repo = new TokensRepository(http, CasperWalletApiByNetworkUrl);

      const tokens = await repo.getTokens({ network: 'mainnet', publicKey: PUBLIC_KEY });

      expect(http.get).toHaveBeenCalledTimes(1);
      const arg = http.get.mock.calls[0][0];
      expect(arg.url).toContain(`${CasperWalletApiByNetworkUrl.mainnet}/accounts/`);
      expect(arg.url).toContain('/ft-token-ownership');
      expect(arg.headers).toEqual(CSPR_API_PROXY_HEADERS);
      expect(tokens).toHaveLength(2);
    });

    it('omits proxy header when withProxyHeader is false', async () => {
      const http = createMockHttpProvider();
      http.get.mockResolvedValueOnce({ data: [] });
      const repo = new TokensRepository(http, CasperWalletApiByNetworkUrl);

      await repo.getTokens({ network: 'mainnet', publicKey: PUBLIC_KEY, withProxyHeader: false });

      const arg = http.get.mock.calls[0][0];
      expect(arg.headers).toBeUndefined();
    });

    it('wraps non-domain errors in TokensError', async () => {
      const http = createMockHttpProvider();
      http.get.mockRejectedValueOnce(new Error('boom'));
      const repo = new TokensRepository(http, CasperWalletApiByNetworkUrl);

      await expect(
        repo.getTokens({ network: 'mainnet', publicKey: PUBLIC_KEY }),
      ).rejects.toBeInstanceOf(TokensError);
    });
  });

  describe('getCsprBalance', () => {
    it('returns a CsprBalanceDto', async () => {
      const http = createMockHttpProvider();
      http.get.mockResolvedValueOnce({ data: makeCsprBalanceResponse() });
      const repo = new TokensRepository(http, CasperWalletApiByNetworkUrl);

      const out = await repo.getCsprBalance({ network: 'mainnet', publicKey: PUBLIC_KEY });
      expect(out!.liquidBalance).toBe('1000000000000');
      expect(out!.totalBalance).toBe('1500000000000');
    });

    it('falls back to a zero balance DTO on 404', async () => {
      const http = createMockHttpProvider();
      http.get.mockRejectedValueOnce(new HttpClientNotFoundError('not found'));
      const repo = new TokensRepository(http, CasperWalletApiByNetworkUrl);

      const out = await repo.getCsprBalance({ network: 'mainnet', publicKey: PUBLIC_KEY });
      expect(out!.liquidBalance).toBe('0');
    });
  });

  describe('getCsprFiatCurrencyRate', () => {
    it('returns a TokenFiatRateDto', async () => {
      const http = createMockHttpProvider();
      http.get.mockResolvedValueOnce(makeCurrencyRateResponse(0.07));
      const repo = new TokensRepository(http, CasperWalletApiByNetworkUrl);

      const out = await repo.getCsprFiatCurrencyRate({ network: 'mainnet' });
      expect(out!.rate).toBe(0.07);
    });
  });

  describe('getCsprToken', () => {
    it('builds an IToken from balance', async () => {
      const http = createMockHttpProvider();
      http.get.mockResolvedValueOnce({ data: makeCsprBalanceResponse() });
      const repo = new TokensRepository(http, CasperWalletApiByNetworkUrl);

      const tok = await repo.getCsprToken({ network: 'mainnet', publicKey: PUBLIC_KEY });
      expect(tok!.symbol).toBe('CSPR');
      expect(tok!.balance).toBe('1000000000000');
    });
  });
});
