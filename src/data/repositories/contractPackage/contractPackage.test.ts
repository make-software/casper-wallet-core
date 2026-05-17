import { ContractPackageRepository } from './index';
import { createMockHttpProvider, makeContractPackageResponse } from '../../../__test-utils__';
import { CasperWalletApiByNetworkUrl, ContractPackageError } from '../../../domain';

describe('ContractPackageRepository', () => {
  it('returns ContractPackageDto on success', async () => {
    const http = createMockHttpProvider();
    http.get.mockResolvedValueOnce({ data: makeContractPackageResponse() });
    const repo = new ContractPackageRepository(http, CasperWalletApiByNetworkUrl);

    const out = await repo.getContractPackage({ contractPackageHash: 'cph', network: 'mainnet' });
    expect(out!.symbol).toBe('PKG');
    expect(out!.decimals).toBe(18);
  });

  it('returns null when API responds with no data', async () => {
    const http = createMockHttpProvider();
    http.get.mockResolvedValueOnce({});
    const repo = new ContractPackageRepository(http, CasperWalletApiByNetworkUrl);

    expect(
      await repo.getContractPackage({ contractPackageHash: 'cph', network: 'mainnet' }),
    ).toBeNull();
  });

  it('wraps unknown errors in ContractPackageError', async () => {
    const http = createMockHttpProvider();
    http.get.mockRejectedValueOnce(new Error('boom'));
    const repo = new ContractPackageRepository(http, CasperWalletApiByNetworkUrl);

    await expect(
      repo.getContractPackage({ contractPackageHash: 'cph', network: 'mainnet' }),
    ).rejects.toBeInstanceOf(ContractPackageError);
  });
});
