import { DeploysRepository } from './index';
import { AccountInfoRepository } from '../accountInfo';
import { createMockHttpProvider, makeCloudDeploy } from '../../../__test-utils__';
import {
  CasperWalletApiByNetworkUrl,
  DeploysError,
  EMPTY_PAGINATED_RESPONSE,
  HttpClientNotFoundError,
} from '../../../domain';

const PUBLIC_KEY = '0106956df3aba7115e28271d053205ec7f33cab259f8e2da2f38150f0ece65a2a8';

const buildRepo = () => {
  const http = createMockHttpProvider();
  const accountInfoRepository = new AccountInfoRepository(http, CasperWalletApiByNetworkUrl);
  // No-op the AccountInfo network call by stubbing its public method.
  jest.spyOn(accountInfoRepository, 'getAccountsInfo').mockResolvedValue({});
  jest.spyOn(accountInfoRepository, 'getAccountInfoFromTransactionsFeed').mockResolvedValue({});
  const repo = new DeploysRepository(http, accountInfoRepository, CasperWalletApiByNetworkUrl);
  return { http, repo, accountInfoRepository };
};

describe('DeploysRepository', () => {
  describe('getDeploys', () => {
    it('returns mapped deploys with paging', async () => {
      const { http, repo } = buildRepo();
      http.get.mockResolvedValueOnce({
        item_count: 1,
        page_count: 1,
        pages: [],
        data: [makeCloudDeploy()],
      });

      const out = await repo.getDeploys({ network: 'mainnet', activePublicKey: PUBLIC_KEY, page: 1 });
      expect(out.data).toHaveLength(1);
      expect(http.get).toHaveBeenCalledTimes(1);
    });

    it('returns empty paginated response on empty API result', async () => {
      const { http, repo } = buildRepo();
      http.get.mockResolvedValueOnce(undefined);
      const out = await repo.getDeploys({ network: 'mainnet', activePublicKey: PUBLIC_KEY, page: 1 });
      expect(out).toEqual(EMPTY_PAGINATED_RESPONSE);
    });

    it('wraps errors', async () => {
      const { http, repo } = buildRepo();
      http.get.mockRejectedValueOnce(new Error('boom'));
      await expect(
        repo.getDeploys({ network: 'mainnet', activePublicKey: PUBLIC_KEY, page: 1 }),
      ).rejects.toBeInstanceOf(DeploysError);
    });
  });

  describe('getSingleDeploy', () => {
    it('returns null when 404', async () => {
      const { http, repo } = buildRepo();
      http.get.mockRejectedValueOnce(new HttpClientNotFoundError('not found'));
      const out = await repo.getSingleDeploy({
        deployHash: 'd'.repeat(64),
        network: 'mainnet',
        activePublicKey: PUBLIC_KEY,
      });
      expect(out).toBeNull();
    });

    it('returns a processed deploy for a single hit', async () => {
      const { http, repo } = buildRepo();
      http.get.mockResolvedValueOnce({ data: makeCloudDeploy() });
      const out = await repo.getSingleDeploy({
        deployHash: 'd'.repeat(64),
        network: 'mainnet',
        activePublicKey: PUBLIC_KEY,
      });
      expect(out).toBeDefined();
      expect(out!.deployHash).toBe('d'.repeat(64));
    });
  });

  describe('getTransactionsFeed', () => {
    it('returns mapped deploys', async () => {
      const { http, repo } = buildRepo();
      http.get.mockResolvedValueOnce({
        item_count: 1,
        page_count: 1,
        pages: [],
        data: [makeCloudDeploy()],
      });
      const out = await repo.getTransactionsFeed({
        network: 'mainnet',
        activePublicKey: PUBLIC_KEY,
        page: 1,
      });
      expect(out.data).toHaveLength(1);
    });

    it('handles a null data response gracefully', async () => {
      const { http, repo } = buildRepo();
      http.get.mockResolvedValueOnce({
        item_count: 0,
        page_count: 0,
        pages: [],
        data: null,
      });
      const out = await repo.getTransactionsFeed({
        network: 'mainnet',
        activePublicKey: PUBLIC_KEY,
        page: 1,
      });
      expect(out.data).toEqual([]);
    });
  });

  describe('getCsprTransferDeploys / getCep18TransferDeploys', () => {
    it('returns empty paginated response when API returns nothing for transfers', async () => {
      const { http, repo } = buildRepo();
      http.get.mockResolvedValueOnce(undefined);
      expect(
        await repo.getCsprTransferDeploys({ network: 'mainnet', activePublicKey: PUBLIC_KEY, page: 1 }),
      ).toEqual(EMPTY_PAGINATED_RESPONSE);
    });

    it('returns empty paginated response when API returns nothing for cep18 transfers', async () => {
      const { http, repo } = buildRepo();
      http.get.mockResolvedValueOnce(undefined);
      expect(
        await repo.getCep18TransferDeploys({ network: 'mainnet', activePublicKey: PUBLIC_KEY, page: 1 }),
      ).toEqual(EMPTY_PAGINATED_RESPONSE);
    });
  });
});
