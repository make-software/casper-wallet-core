import { ContractPackageDto } from './contractPackage';
import { makeContractPackageResponse } from '../../__test-utils__';

describe('ContractPackageDto', () => {
  it('maps the cloud response fields', () => {
    const dto = new ContractPackageDto(makeContractPackageResponse());
    expect(dto.contractPackageHash).toMatch(/^cph_/);
    expect(dto.id).toBe(dto.contractPackageHash);
    expect(dto.decimals).toBe(18);
    expect(dto.symbol).toBe('PKG');
    expect(dto.iconUrl).toContain('pkg.png');
    expect(dto.latestVersionContractTypeId).toBe(2);
  });

  it('falls back to empty defaults', () => {
    const dto = new ContractPackageDto();
    expect(dto.contractPackageHash).toBe('');
    expect(dto.decimals).toBe(0);
    expect(dto.symbol).toBe('');
    expect(dto.iconUrl).toBeNull();
    expect(dto.name).toBe('');
  });
});
