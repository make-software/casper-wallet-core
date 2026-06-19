import { PermitTypes, buildDomain } from '@casper-ecosystem/casper-eip-712';
import { computeTypedDataEIP712Digest } from './digest';

const DOMAIN = buildDomain('CasperSwap', '1', 'casper', '0x' + '01'.repeat(32));
const MESSAGE = {
  owner: '0x00' + '02'.repeat(32),
  spender: '0x01' + '03'.repeat(32),
  value: 1000n,
  nonce: 0n,
  deadline: 1999999999n,
};
const TYPED_DATA = { domain: DOMAIN, types: PermitTypes, primaryType: 'Permit', message: MESSAGE };

describe('computeTypedDataEIP712Digest', () => {
  it('produces the stable EIP-712 digest', () => {
    const { digest, resolvedDomainTypes, hashArtifacts } = computeTypedDataEIP712Digest(TYPED_DATA);
    expect(digest).toBe('0x545a8088d6365ada6ef282f4d5979c655cd428b4115cbf65f561bcd65767a98c');
    expect(resolvedDomainTypes.map(f => f.name)).toEqual([
      'name',
      'version',
      'chain_name',
      'contract_package_hash',
    ]);
    expect(hashArtifacts).toBeUndefined();
  });

  it('populates all six hash artifacts when requested', () => {
    const { hashArtifacts } = computeTypedDataEIP712Digest(TYPED_DATA, {
      returnHashArtifacts: true,
    });
    expect(hashArtifacts).toEqual({
      domainTypeString:
        'EIP712Domain(string name,string version,string chain_name,bytes32 contract_package_hash)',
      domain: DOMAIN,
      domainSeparator: '0xeed1f627794e98725ac59414659cc8799539a6fccbde06b561962f14442a5abc',
      structHash: '0xbd663ef94cb1c6c341a21af953bdf2ce0d48ddde160c42bebe1e08bc36cd0674',
      canonicalTypeString:
        'Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)',
      typeHash: '0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9',
    });
  });

  it('rejects unknown message fields only when asked', () => {
    const withExtra = { ...TYPED_DATA, message: { ...MESSAGE, extra: 1n } };
    expect(() => computeTypedDataEIP712Digest(withExtra, { rejectUnknownFields: true })).toThrow();
  });
});
