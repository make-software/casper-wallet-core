import {
  PERMIT2_MESSAGES,
  PERMIT2_PRIMARY_TYPES,
  Permit2PrimaryType,
  buildPermit2TypedData,
} from '../../__test-utils__/permit2';
import { formatAddress } from '../address';
import { validateTypedDataEIP712Struct } from './validation';
import {
  buildTypedDataEIP712DisplayModel,
  formatEip712Date,
  formatEip712TokenAmount,
  getPresentationForType,
} from './displayModel';
import { keyToLabel } from './walk';

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

  it('formats a date for narrow types at their maximum instead of a sentinel', () => {
    const model = buildTypedDataEIP712DisplayModel(
      td({ validAfter: '255', deadline: '4294967295' }, [
        { name: 'validAfter', type: 'uint8' },
        { name: 'deadline', type: 'uint32' },
      ]),
    );
    const after = model.messageRows.find(r => r.label === 'Valid After')!;
    const deadline = model.messageRows.find(r => r.label === 'Deadline')!;
    expect(after.displayValue).not.toMatch(/Never|Always|No expiry|Expired/);
    expect(after.displayValue).toContain('1970');
    expect(deadline.displayValue).not.toMatch(/Never|Always|No expiry|Expired/);
    expect(deadline.displayValue).toContain('2106');
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

  it('shows a 64-character hex word deadline as a date', () => {
    const row = buildTypedDataEIP712DisplayModel(
      td({ deadline: '0'.repeat(56) + '6ae85b80' }, [{ name: 'deadline', type: 'uint256' }]),
    ).messageRows.find(r => r.label === 'Deadline')!;
    expect(row.value).toBe('1793612672');
    expect(row.presentation).toBe('date');
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

  it('decodes a 0x hex number to decimal', () => {
    const row = buildTypedDataEIP712DisplayModel({
      ...base,
      message: { ...base.message, value: '0x03e8' },
    }).messageRows.find(r => r.label === 'Value')!;
    expect(row.presentation).toBe('number');
    expect(row.value).toBe('1000');
    expect(row.displayValue).toBe('1000');
  });

  it.each([
    ['0x0de0b6b3a7640001', '1000000000000000001', '1000000000000000001'],
    ['0x' + 'ff'.repeat(32), ((1n << 256n) - 1n).toString(), 'Unlimited'],
  ])('decodes %s to its exact decimal', (hex, decimal, displayValue) => {
    const row = buildTypedDataEIP712DisplayModel({
      ...base,
      message: { ...base.message, value: hex },
    }).messageRows.find(r => r.label === 'Value')!;
    expect(row.value).toBe(decimal);
    expect(row.displayValue).toBe(displayValue);
  });

  it('decodes a 0x hex timestamp before formatting it', () => {
    const hex = '0x' + (1782680400).toString(16);
    const row = buildTypedDataEIP712DisplayModel({
      ...base,
      message: { ...base.message, validAfter: hex },
    }).messageRows.find(r => r.label === 'Valid After')!;
    expect(row.presentation).toBe('date');
    expect(row.value).toBe('1782680400');
    expect(row.displayValue).toContain('2026');
  });

  it('recognises a hex sentinel', () => {
    const row = buildTypedDataEIP712DisplayModel({
      ...base,
      message: { ...base.message, validBefore: '0x00' },
    }).messageRows.find(r => r.label === 'Valid Before')!;
    expect(row.displayValue).toBe('Expired');
  });

  it('does not decode hex for non-number types', () => {
    const td = {
      ...base,
      types: { ...base.types, Auth: [{ name: 'tag', type: 'bytes32' }] },
      message: { tag: '0x' + '01'.repeat(32) },
    };
    const row = buildTypedDataEIP712DisplayModel(td).messageRows[0];
    expect(row.presentation).toBe('hash');
    expect(row.value).toBe('0x' + '01'.repeat(32));
  });
});

describe('buildTypedDataEIP712DisplayModel — nested and array values', () => {
  const build = (
    primaryType: Permit2PrimaryType,
    message?: Record<string, unknown>,
    enrichment = {},
  ) =>
    buildTypedDataEIP712DisplayModel(buildPermit2TypedData(primaryType, message, 33), enrichment);
  const sample = (primaryType: Permit2PrimaryType) => PERMIT2_MESSAGES[primaryType][33];

  it('keeps flat rows unchanged and adds path, depth and token', () => {
    const model = buildTypedDataEIP712DisplayModel({
      domain: { chain_name: 'casper' },
      types: {
        EIP712Domain: [{ name: 'chain_name', type: 'string' }],
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'value', type: 'uint256' },
        ],
      },
      primaryType: 'Permit',
      message: { owner: FULL_ADDR, value: '1000' },
    });
    expect(model.messageRows[0]).toEqual({
      label: 'Owner',
      value: FULL_ADDR,
      displayValue: formatAddress(FULL_ADDR, 'short'),
      presentation: 'account',
      type: 'address',
      copyValue: FULL_ADDR,
      accountInfo: null,
      contractPackage: null,
      path: ['owner'],
      depth: 0,
      token: null,
    });
    expect(model.domainRows[0]).toMatchObject({ path: ['chain_name'], depth: 0, token: null });
  });

  it('flattens a nested struct into labelled rows', () => {
    const rows = build('PermitTransferFrom').messageRows;
    expect(rows.map(r => r.label)).toEqual([
      'Permitted › Token',
      'Permitted › Amount',
      'Spender',
      'Nonce',
      'Deadline',
    ]);
    expect(rows[0].path).toEqual(['permitted', 'token']);
    expect(rows[0].depth).toBe(1);
    expect(rows[2].depth).toBe(0);
  });

  it('flattens a struct array with one-based labels and zero-based paths', () => {
    const rows = build('PermitBatch').messageRows;
    expect(rows.map(r => r.label)).toEqual([
      'Details #1 › Token',
      'Details #1 › Amount',
      'Details #1 › Expiration',
      'Details #1 › Nonce',
      'Details #2 › Token',
      'Details #2 › Amount',
      'Details #2 › Expiration',
      'Details #2 › Nonce',
      'Spender',
      'Sig Deadline',
    ]);
    expect(rows[3].path).toEqual(['details', 0, 'nonce']);
    expect(rows[7].path).toEqual(['details', 1, 'nonce']);
    expect(rows[7].depth).toBe(1);
  });

  it('shows one row per primitive array element', () => {
    const model = buildTypedDataEIP712DisplayModel({
      domain: {},
      types: { T: [{ name: 'amounts', type: 'uint256[]' }] },
      primaryType: 'T',
      message: { amounts: ['1', '2'] },
    });
    expect(model.messageRows.map(r => [r.label, r.value])).toEqual([
      ['Amounts #1', '1'],
      ['Amounts #2', '2'],
    ]);
    expect(model.messageRows[1].path).toEqual(['amounts', 1]);
  });

  it('shows an empty array as a single None row', () => {
    const rows = build('PermitBatchTransferFrom', {
      ...sample('PermitBatchTransferFrom'),
      permitted: [],
    }).messageRows;
    expect(rows[0]).toMatchObject({
      label: 'Permitted',
      value: '',
      displayValue: 'None',
      presentation: 'string',
      type: 'TokenPermissions[]',
      path: ['permitted'],
    });
    expect(rows).toHaveLength(4);
  });

  it('counts only string segments for the depth of an empty array inside a struct-array element', () => {
    const model = buildTypedDataEIP712DisplayModel({
      domain: { chain_name: 'casper' },
      types: {
        EIP712Domain: [{ name: 'chain_name', type: 'string' }],
        Outer: [{ name: 'outer', type: 'Inner[]' }],
        Inner: [{ name: 'items', type: 'uint256[]' }],
      },
      primaryType: 'Outer',
      message: { outer: [{ items: [] }] },
    });
    expect(model.messageRows).toHaveLength(1);
    expect(model.messageRows[0]).toMatchObject({
      path: ['outer', 0, 'items'],
      displayValue: 'None',
      depth: 1,
    });
  });

  it('shows witness rows with their presentations', () => {
    const message = sample('PermitWitnessTransferFrom');
    const rows = build('PermitWitnessTransferFrom', {
      ...message,
      witness: { ...(message.witness as object), recipient: '0x00' + '0a'.repeat(32) },
    }).messageRows;
    const recipient = rows.find(r => r.label === 'Witness › Recipient')!;
    const orderId = rows.find(r => r.label === 'Witness › Order Id')!;
    expect(recipient.presentation).toBe('account');
    expect(orderId.presentation).toBe('hash');
  });

  it('decodes a nested hex number', () => {
    const rows = build('PermitTransferFrom', {
      ...sample('PermitTransferFrom'),
      permitted: { token: '0x01' + '01'.repeat(32), amount: '0x03e8' },
    }).messageRows;
    const amount = rows.find(r => r.label === 'Permitted › Amount')!;
    expect(amount.value).toBe('1000');
    expect(amount.displayValue).toBe('1000');
  });

  it('resolves a nested package address through the enrichment', () => {
    const resolveContractPackage = jest.fn().mockReturnValue(null);
    const rows = build('PermitTransferFrom', undefined, { resolveContractPackage }).messageRows;
    expect(rows[0].presentation).toBe('hash');
    expect(resolveContractPackage).toHaveBeenCalledWith('01'.repeat(32));
  });

  it('shows sigDeadline and nested expiration as dates', () => {
    const rows = build('PermitBatch').messageRows;
    const expiration = rows.find(r => r.label === 'Details #1 › Expiration')!;
    expect(expiration.presentation).toBe('date');
    expect(expiration.displayValue).toContain('2026');
    const sig = rows.find(r => r.label === 'Sig Deadline')!;
    expect(sig.presentation).toBe('date');
    expect(sig.displayValue).toContain('2026');
  });

  it('shows No expiry at the uint48 maximum and Current block only at zero', () => {
    const details = (expiration: string) => ({
      details: { ...(sample('PermitSingle').details as object), expiration },
      spender: sample('PermitSingle').spender,
      sigDeadline: '1793613657',
    });
    const max = build('PermitSingle', details('281474976710655')).messageRows;
    expect(max.find(r => r.label === 'Details › Expiration')!.displayValue).toBe('No expiry');
    const zero = build('PermitSingle', details('0')).messageRows;
    expect(zero.find(r => r.label === 'Details › Expiration')!.displayValue).toBe(
      'Current block only',
    );
  });

  it('reads expiration and sigDeadline as seconds even when they are >= 1e12', () => {
    const seconds = '1793612672000';
    const year = String(new Date(Number(seconds) * 1000).getUTCFullYear());
    const rows = build('PermitSingle', {
      details: { ...(sample('PermitSingle').details as object), expiration: seconds },
      spender: sample('PermitSingle').spender,
      sigDeadline: seconds,
    }).messageRows;
    for (const label of ['Details › Expiration', 'Sig Deadline']) {
      const r = rows.find(row => row.label === label)!;
      expect(r.presentation).toBe('date');
      expect(r.displayValue).toContain(year);
      expect(r.displayValue).not.toContain('2026');
    }
  });

  it('shows the raw number for an expiration too large to be a date in seconds', () => {
    const huge = '9000000000000';
    const rows = build('PermitSingle', {
      details: { ...(sample('PermitSingle').details as object), expiration: huge },
      spender: sample('PermitSingle').spender,
      sigDeadline: '1793613657',
    }).messageRows;
    expect(rows.find(r => r.label === 'Details › Expiration')).toMatchObject({
      presentation: 'number',
      displayValue: huge,
    });
  });

  it('keeps Expired for deadline and sigDeadline at zero', () => {
    const rows = build('PermitSingle', {
      details: sample('PermitSingle').details,
      spender: sample('PermitSingle').spender,
      sigDeadline: '0',
    }).messageRows;
    expect(rows.find(r => r.label === 'Sig Deadline')!.displayValue).toBe('Expired');
    const transfer = build('PermitTransferFrom', {
      ...sample('PermitTransferFrom'),
      deadline: '0',
    }).messageRows;
    expect(transfer.find(r => r.label === 'Deadline')!.displayValue).toBe('Expired');
  });

  it('shows Unlimited for an amount at its declared type maximum', () => {
    const single = (amount: string) => ({
      details: { ...(sample('PermitSingle').details as object), amount },
      spender: sample('PermitSingle').spender,
      sigDeadline: '1793613657',
    });
    const u160 = (2n ** 160n - 1n).toString();
    const row = build('PermitSingle', single(u160)).messageRows.find(
      r => r.label === 'Details › Amount',
    )!;
    expect(row.displayValue).toBe('Unlimited');
    expect(row.value).toBe(u160);
    expect(row.presentation).toBe('number');

    const u256 = (2n ** 256n - 1n).toString();
    const transfer = build('PermitTransferFrom', {
      ...sample('PermitTransferFrom'),
      permitted: { token: '0x01' + '01'.repeat(32), amount: u256 },
    }).messageRows.find(r => r.label === 'Permitted › Amount')!;
    expect(transfer.displayValue).toBe('Unlimited');
  });

  it('does not show Unlimited below the declared type maximum', () => {
    const u160 = (2n ** 160n - 1n).toString();
    const row = build('PermitTransferFrom', {
      ...sample('PermitTransferFrom'),
      permitted: { token: '0x01' + '01'.repeat(32), amount: u160 },
    }).messageRows.find(r => r.label === 'Permitted › Amount')!;
    expect(row.displayValue).toBe(u160);
  });

  it.each([
    ['uint8', 'value', (2n ** 8n - 1n).toString()],
    ['uint32', 'amount', (2n ** 32n - 1n).toString()],
    ['uint128', 'amount', (2n ** 128n - 1n).toString()],
  ])('shows the exact number for a %s %s at its type maximum', (type, name, max) => {
    const model = buildTypedDataEIP712DisplayModel({
      domain: { chain_name: 'casper' },
      types: { T: [{ name, type }] },
      primaryType: 'T',
      message: { [name]: max },
    });
    expect(model.messageRows[0]).toMatchObject({ value: max, displayValue: max });
  });

  it('does not throw on unvalidated values and shows wrong shapes as their string', () => {
    const typedData = {
      domain: { chain_name: 'casper' },
      types: {
        Outer: [
          { name: 'inner', type: 'Inner' },
          { name: 'list', type: 'Inner[]' },
          { name: 'amount', type: 'uint256' },
        ],
        Inner: [{ name: 'v', type: 'uint256' }],
        Node: [{ name: 'next', type: 'Node' }],
      },
    };
    const rowsOf = (primaryType: string, message: Record<string, unknown>) =>
      buildTypedDataEIP712DisplayModel({ ...typedData, primaryType, message }).messageRows;

    expect(
      rowsOf('Outer', { inner: 'x', list: 'y', amount: '1' }).map(r => r.displayValue),
    ).toEqual(['x', 'y', '1']);
    expect(rowsOf('Outer', { amount: '1' }).map(r => r.label)).toEqual(['Inner', 'List', 'Amount']);
    expect(() => rowsOf('Node', { next: { next: {} } })).not.toThrow();
  });

  it.each(PERMIT2_PRIMARY_TYPES)('emits one row per validated leaf for %s', primaryType => {
    const data = buildPermit2TypedData(primaryType, undefined, 33);
    const leaves = validateTypedDataEIP712Struct(
      primaryType,
      data.types,
      data.message,
      primaryType,
    );
    expect(buildTypedDataEIP712DisplayModel(data).messageRows).toHaveLength(leaves);
  });
});

describe('formatEip712TokenAmount', () => {
  it('groups the integer part', () => {
    expect(formatEip712TokenAmount(BigInt('1234567891000000000'), 9, 'WCSPR')).toBe(
      '1,234,567,891 WCSPR',
    );
  });
  it('keeps the full fraction without rounding', () => {
    expect(formatEip712TokenAmount(BigInt('1234567891234567891'), 9, 'WCSPR')).toBe(
      '1,234,567,891.234567891 WCSPR',
    );
  });
  it('formats zero', () => {
    expect(formatEip712TokenAmount(BigInt(0), 9, 'WCSPR')).toBe('0 WCSPR');
  });
  it('formats decimals 0', () => {
    expect(formatEip712TokenAmount(BigInt(42), 0, 'TKN')).toBe('42 TKN');
  });
  it('formats a small amount and a 256-bit amount exactly', () => {
    expect(formatEip712TokenAmount(BigInt(1000), 9, 'WCSPR')).toBe('0.000001 WCSPR');
    expect(formatEip712TokenAmount((BigInt(1) << BigInt(255)) + BigInt(1), 18, 'X')).toBe(
      '57,896,044,618,658,097,711,785,492,504,343,953,926,634,992,332,820,282,019,728.792003956564819969 X',
    );
  });
});

describe('buildTypedDataEIP712DisplayModel — token-aware amounts', () => {
  const WCSPR = { contractPackageHash: '01'.repeat(32), symbol: 'WCSPR', decimals: 9 };
  const USDC = { contractPackageHash: '03'.repeat(32), symbol: 'USDC', decimals: 6 };
  const tokens: Record<string, typeof WCSPR> = {
    [WCSPR.contractPackageHash]: WCSPR,
    [USDC.contractPackageHash]: USDC,
  };
  const resolveToken = (hash: string) => tokens[hash] ?? null;
  const build = (
    primaryType: Permit2PrimaryType,
    message?: Record<string, unknown>,
    enrichment: Record<string, unknown> = { resolveToken },
  ) =>
    buildTypedDataEIP712DisplayModel(buildPermit2TypedData(primaryType, message, 33), enrichment);
  const row = (rows: { label: string }[], label: string) =>
    rows.find(r => r.label === label) as ReturnType<typeof build>['messageRows'][number];

  it('pairs an amount with its sibling token', () => {
    const r = row(build('PermitTransferFrom').messageRows, 'Permitted › Amount');
    expect(r.displayValue).toBe('0.000001 WCSPR');
    expect(r.value).toBe('1000');
    expect(r.token).toEqual(WCSPR);
  });

  it('formats each batch entry with its own token', () => {
    const rows = build('PermitBatch').messageRows;
    expect(row(rows, 'Details #1 › Amount')).toMatchObject({
      displayValue: '0.000001 WCSPR',
      token: WCSPR,
    });
    expect(row(rows, 'Details #2 › Amount')).toMatchObject({
      displayValue: '0.001001 USDC',
      value: '1001',
      token: USDC,
    });
  });

  it('shows Unlimited with the symbol at the type maximum', () => {
    const max = '0x' + 'ff'.repeat(20);
    const message = {
      ...PERMIT2_MESSAGES.PermitSingle[33],
      details: { ...(PERMIT2_MESSAGES.PermitSingle[33].details as object), amount: max },
    };
    const r = row(build('PermitSingle', message).messageRows, 'Details › Amount');
    expect(r.displayValue).toBe('Unlimited WCSPR');
    expect(r.token).toEqual(WCSPR);
  });

  it('pairs a flat amount with the domain package', () => {
    const model = buildTypedDataEIP712DisplayModel(
      {
        domain: { chain_name: 'casper', contract_package_hash: '0x' + WCSPR.contractPackageHash },
        types: {
          EIP712Domain: [
            { name: 'chain_name', type: 'string' },
            { name: 'contract_package_hash', type: 'bytes32' },
          ],
          TransferWithAuthorization: [
            { name: 'to', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
          ],
        },
        primaryType: 'TransferWithAuthorization',
        message: { to: FULL_ADDR, value: '7500000000', nonce: '7500000000' },
      },
      { resolveToken },
    );
    expect(model.messageRows[1]).toMatchObject({
      displayValue: '7.5 WCSPR',
      value: '7500000000',
      token: WCSPR,
    });
    expect(model.messageRows[2]).toMatchObject({ displayValue: '7500000000', token: null });
  });

  it('leaves the amount raw when the token does not resolve', () => {
    const r = row(
      build('PermitTransferFrom', undefined, { resolveToken: () => null }).messageRows,
      'Permitted › Amount',
    );
    expect(r).toMatchObject({ displayValue: '1000', token: null });
  });

  it('leaves a nested amount raw when the token sibling is not a package', () => {
    const message = {
      ...PERMIT2_MESSAGES.PermitTransferFrom[33],
      permitted: { token: '00' + '01'.repeat(32), amount: '1000' },
    };
    const r = row(build('PermitTransferFrom', message).messageRows, 'Permitted › Amount');
    expect(r).toMatchObject({ displayValue: '1000', token: null });
  });

  it('does not fall back to the domain package for a top-level amount when a token field exists', () => {
    const model = buildTypedDataEIP712DisplayModel(
      {
        domain: { chain_name: 'casper', contract_package_hash: '0x' + WCSPR.contractPackageHash },
        types: {
          EIP712Domain: [
            { name: 'chain_name', type: 'string' },
            { name: 'contract_package_hash', type: 'bytes32' },
          ],
          T: [
            { name: 'token', type: 'address' },
            { name: 'amount', type: 'uint256' },
          ],
        },
        primaryType: 'T',
        message: { token: '00' + '09'.repeat(32), amount: '1000' },
      },
      { resolveToken },
    );
    expect(model.messageRows[1]).toMatchObject({ displayValue: '1000', token: null });
  });

  it('does not fall back to the domain package when the top-level token field is not an address', () => {
    const model = buildTypedDataEIP712DisplayModel(
      {
        domain: { chain_name: 'casper', contract_package_hash: '0x' + WCSPR.contractPackageHash },
        types: {
          T: [
            { name: 'token', type: 'bytes32' },
            { name: 'amount', type: 'uint256' },
          ],
        },
        primaryType: 'T',
        message: { token: '0x' + '09'.repeat(32), amount: '1000' },
      },
      { resolveToken },
    );
    expect(model.messageRows[1]).toMatchObject({ displayValue: '1000', token: null });
  });

  it('shows the exact token amount for a narrow amount type at its maximum', () => {
    const model = buildTypedDataEIP712DisplayModel(
      {
        domain: { chain_name: 'casper', contract_package_hash: '0x' + WCSPR.contractPackageHash },
        types: { T: [{ name: 'amount', type: 'uint64' }] },
        primaryType: 'T',
        message: { amount: (2n ** 64n - 1n).toString() },
      },
      { resolveToken },
    );
    expect(model.messageRows[0]).toMatchObject({
      displayValue: '18,446,744,073.709551615 WCSPR',
      token: WCSPR,
    });
  });

  it('does not pair a nested amount with the domain package when the token sibling is missing', () => {
    const model = buildTypedDataEIP712DisplayModel(
      {
        domain: { chain_name: 'casper', contract_package_hash: '0x' + WCSPR.contractPackageHash },
        types: {
          EIP712Domain: [
            { name: 'chain_name', type: 'string' },
            { name: 'contract_package_hash', type: 'bytes32' },
          ],
          T: [{ name: 'inner', type: 'U' }],
          U: [{ name: 'amount', type: 'uint256' }],
        },
        primaryType: 'T',
        message: { inner: { amount: '1000' } },
      },
      { resolveToken },
    );
    expect(model.messageRows[0]).toMatchObject({ displayValue: '1000', token: null });
  });

  it('leaves non-amount fields next to a token unchanged', () => {
    const rows = build('PermitSingle').messageRows;
    expect(row(rows, 'Details › Nonce')).toMatchObject({ displayValue: '0', token: null });
    expect(row(rows, 'Sig Deadline').token).toBeNull();
  });

  it('gives raw decimals and a null token without enrichment', () => {
    const r = row(build('PermitTransferFrom', undefined, {}).messageRows, 'Permitted › Amount');
    expect(r).toMatchObject({ displayValue: '1000', token: null });
  });
});
