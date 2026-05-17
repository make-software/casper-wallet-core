import { NftsRepository } from './index';
import { createMockHttpProvider, makeApiNft } from '../../../__test-utils__';
import {
  CasperWalletApiByNetworkUrl,
  CSPR_API_PROXY_HEADERS,
  EMPTY_PAGINATED_RESPONSE,
  NftsError,
} from '../../../domain';

const PUBLIC_KEY = '0106956df3aba7115e28271d053205ec7f33cab259f8e2da2f38150f0ece65a2a8';

describe('NftsRepository', () => {
  describe('getNfts', () => {
    it('returns mapped NFTs and pagination info', async () => {
      const http = createMockHttpProvider();
      http.get.mockResolvedValueOnce({
        item_count: 2,
        page_count: 1,
        pages: [],
        data: [makeApiNft(), makeApiNft({ token_id: '2' })],
      });
      const repo = new NftsRepository(http, CasperWalletApiByNetworkUrl);

      const out = await repo.getNfts({ network: 'mainnet', publicKey: PUBLIC_KEY, page: 1 });
      const arg = http.get.mock.calls[0][0];
      expect(arg.url).toContain(`${CasperWalletApiByNetworkUrl.mainnet}/accounts/`);
      expect(arg.headers).toEqual(CSPR_API_PROXY_HEADERS);
      expect(out.data).toHaveLength(2);
      expect(out.itemCount).toBe(2);
    });

    it('returns an empty paginated response when the API returns nothing', async () => {
      const http = createMockHttpProvider();
      http.get.mockResolvedValueOnce(undefined);
      const repo = new NftsRepository(http, CasperWalletApiByNetworkUrl);

      const out = await repo.getNfts({ network: 'mainnet', publicKey: PUBLIC_KEY, page: 1 });
      expect(out).toEqual(EMPTY_PAGINATED_RESPONSE);
    });

    it('wraps non-domain errors in NftsError', async () => {
      const http = createMockHttpProvider();
      http.get.mockRejectedValueOnce(new Error('boom'));
      const repo = new NftsRepository(http, CasperWalletApiByNetworkUrl);

      await expect(
        repo.getNfts({ network: 'mainnet', publicKey: PUBLIC_KEY, page: 1 }),
      ).rejects.toBeInstanceOf(NftsError);
    });
  });

  describe('deriveNftMediaType', () => {
    it('returns "unknown" when no headers', async () => {
      const http = createMockHttpProvider();
      http.head.mockResolvedValueOnce({});
      const repo = new NftsRepository(http, CasperWalletApiByNetworkUrl);
      expect(await repo.deriveNftMediaType('https://x.com/a.png')).toBe('unknown');
    });

    it('returns the content-type when it matches image/video/audio', async () => {
      const http = createMockHttpProvider();
      http.head.mockResolvedValueOnce({ 'content-type': 'image/png' });
      const repo = new NftsRepository(http, CasperWalletApiByNetworkUrl);
      expect(await repo.deriveNftMediaType('https://x.com/a.png')).toBe('image/png');
    });

    it('returns "unknown" for unrelated content-types', async () => {
      const http = createMockHttpProvider();
      http.head.mockResolvedValueOnce({ 'content-type': 'application/json' });
      const repo = new NftsRepository(http, CasperWalletApiByNetworkUrl);
      expect(await repo.deriveNftMediaType('https://x.com/a.png')).toBe('unknown');
    });

    it('returns "unknown" on errors instead of throwing', async () => {
      const http = createMockHttpProvider();
      http.head.mockRejectedValueOnce(new Error('boom'));
      const repo = new NftsRepository(http, CasperWalletApiByNetworkUrl);
      expect(await repo.deriveNftMediaType('https://x.com/a.png')).toBe('unknown');
    });
  });
});
