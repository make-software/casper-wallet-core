import { buildTypedDataDisplayModel, keyToLabel } from './displayModel';

const FULL_ADDR = '0x00' + '02'.repeat(32);
const PKG_HASH = '0x' + '01'.repeat(32);

describe('keyToLabel', () => {
  it('maps contract_package_hash to "Package Hash"', () => {
    expect(keyToLabel('contract_package_hash')).toBe('Package Hash');
  });
  it('title-cases snake_case otherwise', () => {
    expect(keyToLabel('chain_name')).toBe('Chain Name');
  });
});

describe('buildTypedDataDisplayModel', () => {
  const typedData = {
    domain: { chain_name: 'casper', contract_package_hash: PKG_HASH },
    types: {
      EIP712Domain: [
        { name: 'chain_name', type: 'string' },
        { name: 'contract_package_hash', type: 'bytes32' },
      ],
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'tag', type: 'bytes32' },
        { name: 'value', type: 'uint256' },
      ],
    },
    primaryType: 'Permit',
    message: { owner: FULL_ADDR, tag: PKG_HASH, value: '1000' },
  };

  const model = buildTypedDataDisplayModel(typedData);

  it('domain: contract_package_hash is an address row, bytes32 domain field is NOT', () => {
    const pkg = model.domainRows.find(r => r.label === 'Package Hash')!;
    expect(pkg.isAddress).toBe(true);
    expect(pkg.copyValue).toBe(PKG_HASH);
    expect(pkg.displayValue).not.toBe(PKG_HASH); // shortened
    const chain = model.domainRows.find(r => r.label === 'Chain Name')!;
    expect(chain.isAddress).toBe(false);
    expect(chain.copyValue).toBeNull();
  });

  it('message: both address and bytes32 are address rows', () => {
    const owner = model.messageRows.find(r => r.label === 'Owner')!;
    const tag = model.messageRows.find(r => r.label === 'Tag')!;
    const value = model.messageRows.find(r => r.label === 'Value')!;
    expect(owner.isAddress).toBe(true);
    expect(tag.isAddress).toBe(true); // bytes32 in message IS address-formatted
    expect(value.isAddress).toBe(false);
    expect(owner.copyValue).toBe(FULL_ADDR);
    expect(value.displayValue).toBe('1000');
  });

  it('carries primaryType', () => {
    expect(model.primaryType).toBe('Permit');
  });
});
