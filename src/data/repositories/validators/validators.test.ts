import { ValidatorsRepository } from './index';
import { createMockHttpProvider, makeApiValidator } from '../../../__test-utils__';
import {
  CasperWalletApiByNetworkUrl,
  EMPTY_PAGINATED_RESPONSE,
  ValidatorsError,
} from '../../../domain';

const PUBLIC_KEY = '0106956df3aba7115e28271d053205ec7f33cab259f8e2da2f38150f0ece65a2a8';

describe('ValidatorsRepository', () => {
  describe('getCurrentEraId', () => {
    it('returns era id', async () => {
      const http = createMockHttpProvider();
      http.get.mockResolvedValueOnce({ data: { current_era_id: 9876 } });
      const repo = new ValidatorsRepository(http, CasperWalletApiByNetworkUrl);

      expect(await repo.getCurrentEraId({ network: 'mainnet' })).toBe(9876);
    });

    it('throws ValidatorsError when era id missing', async () => {
      const http = createMockHttpProvider();
      http.get.mockResolvedValueOnce({ data: {} });
      const repo = new ValidatorsRepository(http, CasperWalletApiByNetworkUrl);

      await expect(repo.getCurrentEraId({ network: 'mainnet' })).rejects.toBeInstanceOf(
        ValidatorsError,
      );
    });
  });

  describe('getValidators', () => {
    it('fetches era id then validators', async () => {
      const http = createMockHttpProvider();
      http.get.mockResolvedValueOnce({ data: { current_era_id: 1 } }).mockResolvedValueOnce({
        item_count: 1,
        page_count: 1,
        pages: [],
        data: [makeApiValidator()],
      });
      const repo = new ValidatorsRepository(http, CasperWalletApiByNetworkUrl);

      const out = await repo.getValidators({ network: 'mainnet', page: 1 });
      expect(out.data).toHaveLength(1);
      expect(http.get).toHaveBeenCalledTimes(2);
    });

    it('returns empty paginated response when API returns nothing', async () => {
      const http = createMockHttpProvider();
      http.get
        .mockResolvedValueOnce({ data: { current_era_id: 1 } })
        .mockResolvedValueOnce(undefined);
      const repo = new ValidatorsRepository(http, CasperWalletApiByNetworkUrl);

      expect(await repo.getValidators({ network: 'mainnet', page: 1 })).toEqual(
        EMPTY_PAGINATED_RESPONSE,
      );
    });
  });

  describe('getValidatorsWithStakes', () => {
    it('returns mapped validators with stakes', async () => {
      const http = createMockHttpProvider();
      http.get.mockResolvedValueOnce({ data: { current_era_id: 1 } }).mockResolvedValueOnce({
        data: [
          {
            stake: '1000000000',
            bidder: { public_key: 'v1', total_stake: 0, fee: 0, network_share: '1' },
          } as never,
        ],
      });
      const repo = new ValidatorsRepository(http, CasperWalletApiByNetworkUrl);

      const out = await repo.getValidatorsWithStakes({ network: 'mainnet', publicKey: PUBLIC_KEY });
      expect(out).toHaveLength(1);
    });
  });
});
