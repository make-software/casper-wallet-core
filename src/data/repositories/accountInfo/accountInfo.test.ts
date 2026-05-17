import { AccountInfoRepository } from './index';
import { createMockHttpProvider, makeAccountsInfoResponse, makeCsprBalanceResponse } from '../../../__test-utils__';
import {
  AccountInfoError,
  CasperWalletApiByNetworkUrl,
  HttpClientNotFoundError,
} from '../../../domain';

describe('AccountInfoRepository', () => {
  describe('getAccountsInfo', () => {
    it('POSTs account hashes and returns a hash-keyed map', async () => {
      const http = createMockHttpProvider();
      http.post.mockResolvedValueOnce({ data: [makeAccountsInfoResponse()] });
      const repo = new AccountInfoRepository(http, CasperWalletApiByNetworkUrl);

      const out = await repo.getAccountsInfo({ network: 'mainnet', accountHashes: ['a'.repeat(64)] });
      expect(http.post).toHaveBeenCalledTimes(1);
      expect(Object.keys(out)).toHaveLength(1);
    });

    it('caches result in accountsInfoMapCache', async () => {
      const http = createMockHttpProvider();
      http.post.mockResolvedValueOnce({ data: [makeAccountsInfoResponse()] });
      const repo = new AccountInfoRepository(http, CasperWalletApiByNetworkUrl);

      await repo.getAccountsInfo({ network: 'mainnet', accountHashes: ['a'.repeat(64)] });

      expect(Object.keys(repo.accountsInfoMapCache)).toContain('a'.repeat(64));
    });

    it('wraps unknown errors in AccountInfoError', async () => {
      const http = createMockHttpProvider();
      http.post.mockRejectedValueOnce(new Error('fail'));
      const repo = new AccountInfoRepository(http, CasperWalletApiByNetworkUrl);

      await expect(
        repo.getAccountsInfo({ network: 'mainnet', accountHashes: ['a'] }),
      ).rejects.toBeInstanceOf(AccountInfoError);
    });
  });

  describe('getAccountsBalances', () => {
    it('returns balance map keyed by accountHash', async () => {
      const http = createMockHttpProvider();
      http.post.mockResolvedValueOnce({ data: [makeCsprBalanceResponse()] });
      const repo = new AccountInfoRepository(http, CasperWalletApiByNetworkUrl);

      const out = await repo.getAccountsBalances({
        network: 'mainnet',
        accountHashes: ['a'.repeat(64)],
      });
      expect(Object.values(out)).toHaveLength(1);
    });
  });

  describe('resolveAccountFromCsprName', () => {
    it('returns null when 404', async () => {
      const http = createMockHttpProvider();
      http.get.mockRejectedValueOnce(new HttpClientNotFoundError('not found'));
      const repo = new AccountInfoRepository(http, CasperWalletApiByNetworkUrl);

      expect(await repo.resolveAccountFromCsprName('foo.cspr', 'mainnet')).toBeNull();
    });

    it('returns DTO when not expired', async () => {
      const http = createMockHttpProvider();
      http.get.mockResolvedValueOnce({
        data: {
          name: 'foo.cspr',
          expires_at: '2099-01-01T00:00:00.000Z',
          resolved_public_key: 'pk',
          resolved_hash: 'h',
          account_info: null,
          centralized_account_info: null,
        },
      });
      const repo = new AccountInfoRepository(http, CasperWalletApiByNetworkUrl);

      const out = await repo.resolveAccountFromCsprName('foo.cspr', 'mainnet');
      expect(out!.publicKey).toBe('pk');
    });

    it('returns null for expired resolution', async () => {
      const http = createMockHttpProvider();
      http.get.mockResolvedValueOnce({
        data: {
          name: 'foo.cspr',
          expires_at: '2000-01-01T00:00:00.000Z',
          resolved_public_key: 'pk',
          resolved_hash: 'h',
        },
      });
      const repo = new AccountInfoRepository(http, CasperWalletApiByNetworkUrl);

      const out = await repo.resolveAccountFromCsprName('foo.cspr', 'mainnet');
      expect(out).toBeNull();
    });
  });

  describe('getAccountInfoFromTransactionsFeed', () => {
    it('returns empty for empty feed', async () => {
      const repo = new AccountInfoRepository(createMockHttpProvider(), CasperWalletApiByNetworkUrl);
      const out = await repo.getAccountInfoFromTransactionsFeed([], 'mainnet');
      expect(out).toEqual({});
    });
  });
});
