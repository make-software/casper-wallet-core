import fc from 'fast-check';
import { CASPER_DOMAIN_TYPES, PermitTypes, buildDomain } from '@casper-ecosystem/casper-eip-712';
import { EIP712Error, IEIP712Types, SignTypedDataErrorCodes } from '../../domain';
import {
  resolveDomainTypes,
  validateNoUnknownMessageFields,
  validatePrimaryType,
  validateTypedDataEIP712,
  validateTypedDataEIP712Domain,
  validateTypedDataEIP712FieldTypes,
  validateTypedDataEIP712Values,
} from './validation';

const DOMAIN = buildDomain('CasperSwap', '1', 'casper', '0x' + '01'.repeat(32));

describe('validatePrimaryType', () => {
  it('throws INVALID_PARAMS when primaryType is missing', () => {
    let caught: unknown;
    try {
      validatePrimaryType(PermitTypes, 'Nope');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(EIP712Error);
    expect((caught as EIP712Error).errorCode).toBe(SignTypedDataErrorCodes.INVALID_PARAMS);
  });

  it('passes when primaryType exists', () => {
    expect(() => validatePrimaryType(PermitTypes, 'Permit')).not.toThrow();
  });
});

describe('resolveDomainTypes', () => {
  const casperTypes = () => CASPER_DOMAIN_TYPES.filter(f => DOMAIN[f.name] != null);

  it('accepts types.EIP712Domain equal to the Casper domain types', () => {
    const res = resolveDomainTypes(DOMAIN, { EIP712Domain: casperTypes() }, undefined);
    expect(res).toEqual(casperTypes());
  });

  it('accepts options.domainTypes equal to the Casper domain types', () => {
    const res = resolveDomainTypes(DOMAIN, {}, casperTypes());
    expect(res).toEqual(casperTypes());
  });

  it.each([
    ['types.EIP712Domain', { EIP712Domain: [{ name: 'name', type: 'string' }] }, undefined],
    ['options.domainTypes', {}, [{ name: 'name', type: 'string' }]],
  ])('throws DOMAIN_TYPES_REQUIRED when %s differs', (_, types, option) => {
    expect(() => resolveDomainTypes(DOMAIN, types, option)).toThrow(
      expect.objectContaining({ errorCode: SignTypedDataErrorCodes.DOMAIN_TYPES_REQUIRED }),
    );
  });

  it('derives from CASPER_DOMAIN_TYPES for known fields', () => {
    const res = resolveDomainTypes(DOMAIN, {} as unknown as IEIP712Types, undefined);
    expect(res.map(f => f.name)).toEqual(
      CASPER_DOMAIN_TYPES.filter(f => DOMAIN[f.name] != null).map(f => f.name),
    );
  });

  it('throws DOMAIN_TYPES_REQUIRED for an unknown domain field', () => {
    let caught: unknown;
    try {
      resolveDomainTypes({ unexpected: 'x' }, {} as unknown as IEIP712Types, undefined);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(EIP712Error);
    expect((caught as EIP712Error).errorCode).toBe(SignTypedDataErrorCodes.DOMAIN_TYPES_REQUIRED);
  });
});

describe('validateTypedDataEIP712FieldTypes', () => {
  it('rejects array types', () => {
    expect(() =>
      validateTypedDataEIP712FieldTypes({ T: [{ name: 'a', type: 'uint256[]' }] }),
    ).toThrow(EIP712Error);
  });

  it('rejects a struct-typed field', () => {
    expect(() =>
      validateTypedDataEIP712FieldTypes({
        Order: [{ name: 'details', type: 'Details' }],
        Details: [{ name: 'value', type: 'uint256' }],
      }),
    ).toThrow(expect.objectContaining({ errorCode: SignTypedDataErrorCodes.UNSUPPORTED_TYPE }));
  });

  it('allows bytes32', () => {
    expect(() =>
      validateTypedDataEIP712FieldTypes({ T: [{ name: 'a', type: 'bytes32' }] }),
    ).not.toThrow();
  });

  it.each([
    ['uint256 and bytes', 'bytes'],
    ['uint256 and address', 'address'],
  ])('rejects a field name declared twice (%s) with INVALID_PARAMS', (_, second) =>
    expectInvalid(() =>
      validateTypedDataEIP712FieldTypes({
        T: [
          { name: 'v', type: 'uint256' },
          { name: 'v', type: second },
        ],
      }),
    ),
  );

  it('rejects every bytes1..bytes31 (property)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 31 }), n => {
        try {
          validateTypedDataEIP712FieldTypes({ T: [{ name: 'a', type: `bytes${n}` }] });
          return false;
        } catch (e) {
          return (e as EIP712Error).errorCode === SignTypedDataErrorCodes.UNSUPPORTED_TYPE;
        }
      }),
    );
  });
});

describe('validateNoUnknownMessageFields', () => {
  it('throws INVALID_PARAMS for unknown message key', () => {
    let caught: unknown;
    try {
      validateNoUnknownMessageFields(PermitTypes, 'Permit', { surprise: 1 });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(EIP712Error);
    expect((caught as EIP712Error).errorCode).toBe(SignTypedDataErrorCodes.INVALID_PARAMS);
  });

  it('passes when all keys are known', () => {
    expect(() =>
      validateNoUnknownMessageFields(PermitTypes, 'Permit', { owner: 'x' }),
    ).not.toThrow();
  });
});

const expectInvalid = (fn: () => void, code: string = SignTypedDataErrorCodes.INVALID_PARAMS) =>
  expect(fn).toThrow(expect.objectContaining({ errorCode: code }));

describe('validateTypedDataEIP712Values', () => {
  const one = (type: string, value: unknown) => () =>
    validateTypedDataEIP712Values('T', [{ name: 'a', type }], { a: value });

  it('accepts bigint, safe number, decimal string and 0x hex for uint256', () => {
    expect(one('uint256', 1000n)).not.toThrow();
    expect(one('uint256', 1000)).not.toThrow();
    expect(one('uint256', '1000')).not.toThrow();
    expect(one('uint256', '0x03e8')).not.toThrow();
    expect(one('uint256', (1n << 256n) - 1n)).not.toThrow();
  });

  it.each([
    ['garbage', 'abc'],
    ['exponent', '1e3'],
    ['empty', ''],
    ['odd-length hex', '0x3e8'],
    ['unsafe number', 2 ** 53],
    ['negative bigint', -1n],
    ['negative string', '-1'],
    ['over 256 bits', 1n << 256n],
    ['null', null],
    ['undefined', undefined],
  ])('rejects %s for uint256', (_, value) => expectInvalid(one('uint256', value)));

  it('range-checks uint8 and int8 and rejects negatives for int8', () => {
    expect(one('uint8', 255n)).not.toThrow();
    expect(one('uint8', '255')).not.toThrow();
    expectInvalid(one('uint8', 256n));
    expect(one('int8', 0n)).not.toThrow();
    expect(one('int8', '127')).not.toThrow();
    expect(one('int8', '0x7f')).not.toThrow();
    expectInvalid(one('int8', 128n));
    expectInvalid(one('int8', -1n));
    expectInvalid(one('int256', -1n));
  });

  it('treats bare uint/int as 256-bit', () => {
    expect(one('uint', 1n)).not.toThrow();
    expect(one('int', 1n)).not.toThrow();
  });

  it('requires a real boolean for bool', () => {
    expect(one('bool', false)).not.toThrow();
    expectInvalid(one('bool', 'false'));
    expectInvalid(one('bool', 0));
  });

  it('requires a string for string', () => {
    expect(one('string', 'hi')).not.toThrow();
    expectInvalid(one('string', 1));
  });

  it('validates address as 20 or 33 strict-hex bytes', () => {
    expect(one('address', '0x00' + 'aa'.repeat(32))).not.toThrow();
    expect(one('address', 'aa'.repeat(20))).not.toThrow();
    expectInvalid(one('address', '0x' + 'aa'.repeat(32)));
    expectInvalid(one('address', '0x00' + 'zz'.repeat(32)));
  });

  it('validates bytes32 as exactly 32 strict-hex bytes', () => {
    expect(one('bytes32', '0x' + '01'.repeat(32))).not.toThrow();
    expect(one('bytes32', '01'.repeat(32))).not.toThrow();
    expectInvalid(one('bytes32', '0x' + '01'.repeat(31)));
  });

  it('accepts only a hex string for bytes', () => {
    expect(one('bytes', '0x')).not.toThrow();
    expect(one('bytes', '0x0102')).not.toThrow();
    expectInvalid(one('bytes', new Uint8Array([1])));
    expectInvalid(one('bytes', 'xyz'));
  });

  it.each([
    ['bytes', '0X01'],
    ['bytes32', '0X' + '01'.repeat(31)],
    ['address', '0X' + 'aa'.repeat(19)],
  ])('rejects an uppercase 0X prefix for %s', (type, value) => expectInvalid(one(type, value)));

  it('names the field in the error', () => {
    expect(() =>
      validateTypedDataEIP712Values('Permit', [{ name: 'value', type: 'uint256' }], {}),
    ).toThrow(/Permit\.value/);
  });
});

describe('validateTypedDataEIP712FieldTypes — whitelist', () => {
  it.each(['uintFoo', 'uint7', 'uint264', 'int0', 'bytes33', 'Foo'])(
    'rejects %s with UNSUPPORTED_TYPE',
    type =>
      expectInvalid(
        () => validateTypedDataEIP712FieldTypes({ T: [{ name: 'a', type }] }),
        SignTypedDataErrorCodes.UNSUPPORTED_TYPE,
      ),
  );
});

describe('validateTypedDataEIP712 — unknown fields', () => {
  const typedData = {
    domain: DOMAIN,
    types: { T: [{ name: 'a', type: 'uint256' }] },
    primaryType: 'T',
    message: { a: 1n, extra: 1n },
  };

  it('rejects an extra message key with rejectUnknownFields', () => {
    expectInvalid(() => validateTypedDataEIP712(typedData, { rejectUnknownFields: true }));
  });

  it('allows an extra message key by default', () => {
    expect(() => validateTypedDataEIP712(typedData)).not.toThrow();
  });
});

const domainWithout = (key: string) =>
  Object.fromEntries(Object.entries(DOMAIN).filter(([k]) => k !== key));

describe('validateTypedDataEIP712Domain', () => {
  const WITHOUT_CHAIN = domainWithout('chain_name');
  const WITHOUT_PACKAGE = domainWithout('contract_package_hash');

  it.each(['casper', 'casper-test', 'dev-net', 'integration-test', 'casper:casper-test'])(
    'accepts the full Casper domain with chain_name %p',
    chainName =>
      expect(() =>
        validateTypedDataEIP712Domain({ ...DOMAIN, chain_name: chainName }),
      ).not.toThrow(),
  );

  it.each([
    'evil:casper',
    'casper-test:casper',
    'x:y:casper-test',
    'casper:casper:casper',
    'casper:',
    'mainnet',
    'testnet',
    'Casper',
  ])('rejects chain_name %p with INVALID_PARAMS', chainName =>
    expectInvalid(() => validateTypedDataEIP712Domain({ ...DOMAIN, chain_name: chainName })),
  );

  it.each([
    ['missing chain_name', WITHOUT_CHAIN],
    ['missing contract_package_hash', WITHOUT_PACKAGE],
    ['missing name', domainWithout('name')],
    ['missing version', domainWithout('version')],
    ['unmappable chain_name', { ...DOMAIN, chain_name: 'unknown-chain' }],
    ['non-string chain_name', { ...DOMAIN, chain_name: 1 }],
    ['null value', { ...DOMAIN, contract_package_hash: null }],
    ['undefined value', { ...DOMAIN, version: undefined }],
  ])('rejects %s with INVALID_PARAMS', (_, domain) =>
    expectInvalid(() => validateTypedDataEIP712Domain(domain)),
  );

  it('names the missing field', () => {
    expect(() => validateTypedDataEIP712Domain(WITHOUT_CHAIN)).toThrow(/chain_name/);
    expect(() => validateTypedDataEIP712Domain(WITHOUT_PACKAGE)).toThrow(/contract_package_hash/);
  });
});

describe('validateTypedDataEIP712 — domain values', () => {
  const td = (domain: Record<string, unknown>) => ({
    domain,
    types: PermitTypes,
    primaryType: 'Permit',
    message: {
      owner: '0x00' + '02'.repeat(32),
      spender: '0x01' + '03'.repeat(32),
      value: 1n,
      nonce: 0n,
      deadline: 1n,
    },
  });

  it('type-checks domain values against the resolved domain types', () => {
    expectInvalid(() =>
      validateTypedDataEIP712(td({ ...DOMAIN, contract_package_hash: '0x' + '01'.repeat(31) })),
    );
    expectInvalid(() => validateTypedDataEIP712(td({ ...DOMAIN, name: 1 })));
  });

  it('resolves the full Casper domain types in canonical order', () => {
    expect(validateTypedDataEIP712(td(DOMAIN)).map(f => f.name)).toEqual([
      'name',
      'version',
      'chain_name',
      'contract_package_hash',
    ]);
  });

  it('keeps DOMAIN_TYPES_REQUIRED for an unknown domain key', () => {
    expectInvalid(
      () => validateTypedDataEIP712(td({ ...DOMAIN, foo: 'x' })),
      SignTypedDataErrorCodes.DOMAIN_TYPES_REQUIRED,
    );
  });
});

describe('validateTypedDataEIP712 — malformed typed data', () => {
  const valid = {
    domain: DOMAIN,
    types: { T: [{ name: 'a', type: 'uint256' }] },
    primaryType: 'T',
    message: { a: 1n },
  };

  it.each([
    ['domain', { ...valid, domain: undefined }],
    ['types', { ...valid, types: null }],
    ['message', { ...valid, message: undefined }],
    ['message as a string', { ...valid, message: 'a' }],
  ])('rejects a missing or non-object %s with INVALID_PARAMS', (_, typedData) =>
    expectInvalid(() => validateTypedDataEIP712(typedData as never)),
  );
});
