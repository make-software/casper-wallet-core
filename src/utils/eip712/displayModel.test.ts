import {
  buildTypedDataEIP712DisplayModel,
  getPresentationForType,
  keyToLabel,
} from './displayModel';

const FULL_ADDR = 'a'.repeat(64); // 64 hex chars, no 0x prefix — like a Casper account hash
const PKG_HASH = '0x' + '01'.repeat(32);

describe('getPresentationForType', () => {
  it('classifies bytes1..bytes32 as hash', () => {
    expect(getPresentationForType('bytes1')).toBe('hash');
    expect(getPresentationForType('bytes32')).toBe('hash');
  });
  it('classifies uint*/int* as number', () => {
    expect(getPresentationForType('uint8')).toBe('number');
    expect(getPresentationForType('uint256')).toBe('number');
    expect(getPresentationForType('int256')).toBe('number');
    expect(getPresentationForType('uint')).toBe('number');
    expect(getPresentationForType('int')).toBe('number');
  });
  it('classifies address as account', () => {
    expect(getPresentationForType('address')).toBe('account');
  });
  it('classifies bool and unknown as string', () => {
    expect(getPresentationForType('bool')).toBe('string');
    expect(getPresentationForType('string')).toBe('string');
    expect(getPresentationForType('bytes33')).toBe('string');
  });
});

describe('keyToLabel', () => {
  it('maps contract_package_hash to "Package Hash"', () => {
    expect(keyToLabel('contract_package_hash')).toBe('Package Hash');
  });
  it('title-cases snake_case otherwise', () => {
    expect(keyToLabel('chain_name')).toBe('Chain Name');
  });
});

describe('buildTypedDataEIP712DisplayModel', () => {
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

  it('classifies presentation and leaves enrichment null on the sync path', () => {
    const model = buildTypedDataEIP712DisplayModel(typedData);

    const pkg = model.domainRows.find(r => r.label === 'Package Hash')!;
    expect(pkg.presentation).toBe('hash');
    expect(pkg.copyValue).toBe(PKG_HASH);
    expect(pkg.displayValue).not.toBe(PKG_HASH); // shortened
    expect(pkg.accountInfo).toBeNull();
    expect(pkg.contractPackage).toBeNull();

    const chain = model.domainRows.find(r => r.label === 'Chain Name')!;
    expect(chain.presentation).toBe('string');
    expect(chain.copyValue).toBeNull();

    const owner = model.messageRows.find(r => r.label === 'Owner')!;
    const value = model.messageRows.find(r => r.label === 'Value')!;
    expect(owner.presentation).toBe('account');
    expect(owner.copyValue).toBe(FULL_ADDR);
    expect(owner.accountInfo).toBeNull();
    expect(value.presentation).toBe('number');
    expect(value.displayValue).toBe('1000');
    expect(model.primaryType).toBe('Permit');

    const tag = model.messageRows.find(r => r.label === 'Tag')!;
    expect(tag.presentation).toBe('hash'); // bytes32 in message → hash, not account
    expect(tag.copyValue).toBe(PKG_HASH); // still shortened + copyable
  });

  it('forces hash presentation for an undeclared domain contract_package_hash', () => {
    const undeclared = {
      domain: { chain_name: 'casper', contract_package_hash: FULL_ADDR },
      types: { EIP712Domain: [], Permit: [{ name: 'value', type: 'uint256' }] },
      primaryType: 'Permit',
      message: { value: '1' },
    };

    const pkg = buildTypedDataEIP712DisplayModel(undeclared).domainRows.find(
      r => r.label === 'Package Hash',
    )!;
    expect(pkg.type).toBe(''); // not declared in types.EIP712Domain
    expect(pkg.presentation).toBe('hash');
    expect(pkg.copyValue).toBe(FULL_ADDR); // full value copyable
    expect(pkg.displayValue).not.toBe(FULL_ADDR); // shortened
  });

  it('attaches enrichment through the callback', () => {
    const accountInfo = {
      id: 'x',
      publicKey: '02pub',
      accountHash: FULL_ADDR,
      name: 'Alice',
      brandingLogo: null,
      csprName: null,
      explorerLink: null,
    };
    const contractPackage = {
      id: 'c',
      latestVersionContractTypeId: 1,
      contractPackageHash: PKG_HASH,
      name: 'MyToken',
      iconUrl: null,
      symbol: 'MTK',
      decimals: 9,
    };

    const model = buildTypedDataEIP712DisplayModel(typedData, {
      resolveAccountInfo: value => (value === FULL_ADDR ? accountInfo : null),
      contractPackage,
    });

    expect(model.messageRows.find(r => r.label === 'Owner')!.accountInfo).toEqual(accountInfo);
    expect(model.domainRows.find(r => r.label === 'Package Hash')!.contractPackage).toEqual(
      contractPackage,
    );
    expect(model.messageRows.find(r => r.label === 'Value')!.accountInfo).toBeNull();
  });
});
