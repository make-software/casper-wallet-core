import {
  buildTypedDataEIP712DisplayModel,
  formatEip712Date,
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
  it('splits camelCase field names', () => {
    expect(keyToLabel('validAfter')).toBe('Valid After');
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

    const pkgHashClean = '01'.repeat(32); // PKG_HASH with 0x stripped
    const pkg = model.domainRows.find(r => r.label === 'Package Hash')!;
    expect(pkg.presentation).toBe('hash');
    expect(pkg.copyValue).toBe(pkgHashClean); // 0x prefix stripped in new implementation
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
      csprNameExpiresAt: null,
      explorerLink: null,
    };
    // PKG_HASH = '0x' + '01'.repeat(32); strip 0x -> '01'.repeat(32)
    const pkgHashClean = '01'.repeat(32);
    const contractPackage = {
      id: 'c',
      latestVersionContractTypeId: 1,
      contractPackageHash: pkgHashClean,
      name: 'MyToken',
      iconUrl: null,
      symbol: 'MTK',
      decimals: 9,
    };

    // Use '00' + FULL_ADDR so the decoder strips the tag and calls resolveAccountInfo(FULL_ADDR)
    const tdWithTaggedOwner = {
      ...typedData,
      message: { ...typedData.message, owner: '00' + FULL_ADDR },
    };

    const model = buildTypedDataEIP712DisplayModel(tdWithTaggedOwner, {
      resolveAccountInfo: h => (h === FULL_ADDR ? accountInfo : null),
      resolveContractPackage: h => (h === pkgHashClean ? contractPackage : null),
    });

    const ownerRow = model.messageRows.find(r => r.label === 'Owner')!;
    expect(ownerRow.accountInfo).toEqual(accountInfo);
    expect(ownerRow.value).toBe(FULL_ADDR); // tag stripped

    expect(model.domainRows.find(r => r.label === 'Package Hash')!.contractPackage).toEqual(
      contractPackage,
    );
    expect(model.messageRows.find(r => r.label === 'Value')!.accountInfo).toBeNull();
  });

  it('keeps all domain keys when excludeDomainKeys is not provided', () => {
    const model = buildTypedDataEIP712DisplayModel(typedData);
    expect(model.domainRows.find(r => r.label === 'Chain Name')).toBeDefined();
  });

  it('omits domain keys listed in excludeDomainKeys', () => {
    const model = buildTypedDataEIP712DisplayModel(typedData, {}, ['chain_name']);
    expect(model.domainRows.find(r => r.label === 'Chain Name')).toBeUndefined();
    expect(model.domainRows.find(r => r.label === 'Package Hash')).toBeDefined();
    expect(model.messageRows.find(r => r.label === 'Owner')).toBeDefined();
  });
});

describe('formatEip712Date', () => {
  it('formats unix seconds', () => {
    // 2026-06-23T21:00:00Z = 1782680400 s
    const out = formatEip712Date('1782680400');
    expect(out).not.toBeNull();
    expect(out).toContain('2026');
  });
  it('treats values >= 1e12 as milliseconds', () => {
    expect(formatEip712Date('1782680400000')).toContain('2026');
  });
  it('returns null for non-numeric, non-positive, or invalid input', () => {
    expect(formatEip712Date('not-a-number')).toBeNull();
    expect(formatEip712Date('0')).toBeNull();
    expect(formatEip712Date('-5')).toBeNull();
  });
  it('returns null when the value is past the representable Date range', () => {
    expect(formatEip712Date('1e30')).toBeNull();
  });
});

describe('buildTypedDataEIP712DisplayModel — address kinds', () => {
  const ACC = 'a'.repeat(64);
  const PKG = 'b'.repeat(64);
  const td = {
    domain: {},
    types: {
      Transfer: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'other', type: 'address' },
      ],
    },
    primaryType: 'Transfer',
    message: { from: '00' + ACC, to: '01' + PKG, other: '02' + ACC },
  };

  it('renders an account address via resolveAccountInfo with the clean hash', () => {
    const accountInfo = {
      id: 'x',
      publicKey: '01pk',
      accountHash: ACC,
      name: 'Alice',
      brandingLogo: null,
      csprName: null,
      csprNameExpiresAt: null,
      explorerLink: null,
    };
    const model = buildTypedDataEIP712DisplayModel(td, {
      resolveAccountInfo: h => (h === ACC ? accountInfo : null),
    });
    const from = model.messageRows.find(r => r.label === 'From')!;
    expect(from.presentation).toBe('account');
    expect(from.value).toBe(ACC); // tag stripped
    expect(from.copyValue).toBe(ACC);
    expect(from.accountInfo).toEqual(accountInfo);
  });

  it('renders a package address via resolveContractPackage as a hash row', () => {
    const pkg = {
      id: 'c',
      latestVersionContractTypeId: 1,
      contractPackageHash: PKG,
      name: 'Tok',
      iconUrl: null,
      symbol: 'T',
      decimals: 9,
    };
    const to = buildTypedDataEIP712DisplayModel(td, {
      resolveContractPackage: h => (h === PKG ? pkg : null),
    }).messageRows.find(r => r.label === 'To')!;
    expect(to.presentation).toBe('hash');
    expect(to.value).toBe(PKG);
    expect(to.contractPackage).toEqual(pkg);
  });

  it('renders an unknown-tag address as a raw hash row', () => {
    const other = buildTypedDataEIP712DisplayModel(td).messageRows.find(r => r.label === 'Other')!;
    expect(other.presentation).toBe('hash');
    expect(other.contractPackage).toBeNull();
    expect(other.accountInfo).toBeNull();
  });
});

describe('buildTypedDataEIP712DisplayModel — date sentinels & trim', () => {
  const td = (msg: Record<string, unknown>, fields: { name: string; type: string }[]) => ({
    domain: {},
    types: { Auth: fields },
    primaryType: 'Auth',
    message: msg,
  });

  it('shows "Always" for a 0 validAfter and "No expiry" for u64::MAX validBefore', () => {
    const model = buildTypedDataEIP712DisplayModel(
      td({ validAfter: '0', validBefore: '18446744073709551615' }, [
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
      ]),
    );
    expect(model.messageRows.find(r => r.label === 'Valid After')!.displayValue).toBe('Always');
    expect(model.messageRows.find(r => r.label === 'Valid Before')!.displayValue).toBe('No expiry');
  });

  it('keys the sentinel label on field role, not just the value', () => {
    const model = buildTypedDataEIP712DisplayModel(
      td(
        {
          validAfter: '18446744073709551615',
          validBefore: '0',
          deadline: '0',
        },
        [
          { name: 'validAfter', type: 'uint256' },
          { name: 'validBefore', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      ),
    );
    // Lower bound at u64::MAX is never reachable, not "no expiry".
    expect(model.messageRows.find(r => r.label === 'Valid After')!.displayValue).toBe('Never');
    // Upper bound at 0 is already expired, not "always".
    expect(model.messageRows.find(r => r.label === 'Valid Before')!.displayValue).toBe('Expired');
    expect(model.messageRows.find(r => r.label === 'Deadline')!.displayValue).toBe('Expired');
  });

  it('no longer treats validUntil/expiry as dates (trimmed)', () => {
    const row = buildTypedDataEIP712DisplayModel(
      td({ validUntil: '1782680400' }, [{ name: 'validUntil', type: 'uint256' }]),
    ).messageRows.find(r => r.label === 'Valid Until')!;
    expect(row.presentation).toBe('number');
  });
});

describe('buildTypedDataEIP712DisplayModel — dates', () => {
  const base = {
    domain: { chain_name: 'casper' },
    types: {
      EIP712Domain: [{ name: 'chain_name', type: 'string' }],
      Auth: [
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'value', type: 'uint256' },
        { name: 'note', type: 'string' },
      ],
    },
    primaryType: 'Auth',
    message: {
      validAfter: '1782680400',
      validBefore: '1782684000',
      value: '1000',
      note: 'hi',
    },
  };

  it('renders known timestamp fields as date presentation', () => {
    const model = buildTypedDataEIP712DisplayModel(base);
    const va = model.messageRows.find(r => r.label === 'Valid After')!;
    expect(va.presentation).toBe('date');
    expect(va.displayValue).not.toBe('1782680400');
    expect(va.displayValue).toContain('2026');
    expect(va.copyValue).toBeNull();
    expect(model.messageRows.find(r => r.label === 'Valid Before')!.presentation).toBe('date');
  });

  it('leaves a non-timestamp numeric field as number', () => {
    const value = buildTypedDataEIP712DisplayModel(base).messageRows.find(
      r => r.label === 'Value',
    )!;
    expect(value.presentation).toBe('number');
    expect(value.displayValue).toBe('1000');
  });

  it('does not treat a date-named non-numeric field as a date', () => {
    const td = {
      ...base,
      types: { ...base.types, Auth: [{ name: 'validAfter', type: 'string' }] },
      message: { validAfter: 'soon' },
    };
    const row = buildTypedDataEIP712DisplayModel(td).messageRows.find(
      r => r.label === 'Valid After',
    )!;
    expect(row.presentation).toBe('string');
  });

  it('falls back to number when a timestamp value is unparseable', () => {
    const td = { ...base, message: { ...base.message, validAfter: 'oops' } };
    const row = buildTypedDataEIP712DisplayModel(td).messageRows.find(
      r => r.label === 'Valid After',
    )!;
    expect(row.presentation).toBe('number');
    expect(row.displayValue).toBe('oops');
  });
});
