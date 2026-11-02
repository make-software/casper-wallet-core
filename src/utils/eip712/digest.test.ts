import { TypedDataEncoder } from 'ethers';
import {
  CASPER_DOMAIN_TYPES,
  PermitTypes,
  buildDomain,
  fromHex,
  keccak256,
  toHex,
} from '@casper-ecosystem/casper-eip-712';
import { SignTypedDataErrorCodes } from '../../domain';
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

  it('rejects a domain without a mappable chain_name', () => {
    const unbound = Object.fromEntries(Object.entries(DOMAIN).filter(([k]) => k !== 'chain_name'));
    expect(() => computeTypedDataEIP712Digest({ ...TYPED_DATA, domain: unbound })).toThrow(
      expect.objectContaining({ errorCode: SignTypedDataErrorCodes.INVALID_PARAMS }),
    );
  });

  it('computes a digest for a testnet domain', () => {
    const testnet = { ...TYPED_DATA, domain: { ...DOMAIN, chain_name: 'casper-test' } };
    expect(computeTypedDataEIP712Digest(testnet).digest).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

describe('computeTypedDataEIP712Digest — strict type validation', () => {
  const ORDER_TYPES = {
    Order: [
      { name: 'nonce', type: 'uint256' },
      { name: 'details', type: 'Details' },
    ],
    Details: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
  };

  it('hashes a struct-typed field to the ethers struct hash under the library domain separator', () => {
    const message = { nonce: 1n, details: { to: '0x' + '02'.repeat(20), value: 999999999n } };
    const order = { domain: DOMAIN, types: ORDER_TYPES, primaryType: 'Order', message };
    const { digest, hashArtifacts } = computeTypedDataEIP712Digest(order, {
      returnHashArtifacts: true,
    });
    const ethersStructHash = TypedDataEncoder.from(ORDER_TYPES).hash(message);
    expect(hashArtifacts!.structHash).toBe(ethersStructHash);
    expect(digest).toBe(
      toHex(
        keccak256(
          new Uint8Array([
            0x19,
            0x01,
            ...fromHex(hashArtifacts!.domainSeparator),
            ...fromHex(ethersStructHash),
          ]),
        ),
      ),
    );
  });

  it('rejects options.domainTypes that differ from the Casper domain types', () => {
    const reordered = [
      { name: 'contract_package_hash', type: 'bytes32' },
      { name: 'chain_name', type: 'string' },
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
    ];
    expect(() => computeTypedDataEIP712Digest(TYPED_DATA, { domainTypes: reordered })).toThrow(
      expect.objectContaining({ errorCode: SignTypedDataErrorCodes.DOMAIN_TYPES_REQUIRED }),
    );
  });

  it('rejects types.EIP712Domain that differs from the Casper domain types', () => {
    const retyped = {
      ...TYPED_DATA,
      types: {
        ...PermitTypes,
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chain_name', type: 'string' },
          { name: 'contract_package_hash', type: 'string' },
        ],
      },
    };
    expect(() => computeTypedDataEIP712Digest(retyped)).toThrow(
      expect.objectContaining({ errorCode: SignTypedDataErrorCodes.DOMAIN_TYPES_REQUIRED }),
    );
  });

  it('accepts explicit domain types equal to the Casper domain types', () => {
    const { digest } = computeTypedDataEIP712Digest(
      { ...TYPED_DATA, types: { ...PermitTypes, EIP712Domain: [...CASPER_DOMAIN_TYPES] } },
      { domainTypes: [...CASPER_DOMAIN_TYPES] },
    );
    expect(digest).toBe('0x545a8088d6365ada6ef282f4d5979c655cd428b4115cbf65f561bcd65767a98c');
  });
});

describe('computeTypedDataEIP712Digest — numeric forms', () => {
  const withValue = (value: unknown) => ({ ...TYPED_DATA, message: { ...MESSAGE, value } });
  const digestOf = (value: unknown) => computeTypedDataEIP712Digest(withValue(value)).digest;

  it('hashes a decimal string as the decimal it reads as', () => {
    expect(digestOf('1000')).toBe(digestOf(1000n));
    expect(digestOf('1000')).not.toBe(digestOf(4096n));
  });

  it('computes the struct hash artifact over the normalised value', () => {
    const { hashArtifacts } = computeTypedDataEIP712Digest(withValue('1000'), {
      returnHashArtifacts: true,
    });
    expect(hashArtifacts?.structHash).toBe(
      '0xbd663ef94cb1c6c341a21af953bdf2ce0d48ddde160c42bebe1e08bc36cd0674',
    );
  });

  it('rejects a field name declared as both a number and bytes', () => {
    expect(() =>
      computeTypedDataEIP712Digest({
        domain: DOMAIN,
        types: {
          T: [
            { name: 'v', type: 'uint256' },
            { name: 'v', type: 'bytes' },
          ],
        },
        primaryType: 'T',
        message: { v: '0x03e8' },
      }),
    ).toThrow(expect.objectContaining({ errorCode: SignTypedDataErrorCodes.INVALID_PARAMS }));
  });

  it('hashes 0x hex and safe numbers like the bigint', () => {
    expect(digestOf('0x03e8')).toBe(digestOf(1000n));
    expect(digestOf(1000)).toBe(digestOf(1000n));
  });

  it('hashes a 64-character hex word like the same bigint', () => {
    expect(digestOf('0'.repeat(61) + '3e8')).toBe(digestOf(1000n));
    expect(digestOf('0'.repeat(61) + '3e8')).toBe(digestOf('0x03e8'));
    expect(digestOf('0'.repeat(61) + '3e8')).toBe(digestOf('1000'));
  });

  it('rejects a 64-digit decimal-looking word and an out-of-range word for uint48', () => {
    expectInvalidParams(withValue('1' + '0'.repeat(63)));
    expectInvalidParams({
      domain: DOMAIN,
      types: { T: [{ name: 'v', type: 'uint48' }] },
      primaryType: 'T',
      message: { v: '0'.repeat(51) + '1' + '0'.repeat(12) },
    });
  });

  const expectInvalidParams = (td: Parameters<typeof computeTypedDataEIP712Digest>[0]) =>
    expect(() => computeTypedDataEIP712Digest(td)).toThrow(
      expect.objectContaining({ errorCode: SignTypedDataErrorCodes.INVALID_PARAMS }),
    );

  it.each([['abc'], ['1e3'], [''], ['-1'], ['0x3e8'], [2 ** 53]])('rejects %p for uint256', value =>
    expectInvalidParams(withValue(value)),
  );

  it.each([['abc'], ['1e3'], [''], ['0x3e8']])('names Permit.value when rejecting %p', value =>
    expect(() => computeTypedDataEIP712Digest(withValue(value))).toThrow(/Permit\.value/),
  );

  it('rejects a null declared field', () => {
    expectInvalidParams({ ...TYPED_DATA, message: { ...MESSAGE, nonce: null } });
  });

  it('rejects a bool given as a string', () => {
    expectInvalidParams({
      domain: DOMAIN,
      types: { Flag: [{ name: 'ok', type: 'bool' }] },
      primaryType: 'Flag',
      message: { ok: 'false' },
    });
  });

  it('rejects a missing declared field', () => {
    const rest = Object.fromEntries(Object.entries(MESSAGE).filter(([key]) => key !== 'nonce'));
    expect(() => computeTypedDataEIP712Digest({ ...TYPED_DATA, message: rest })).toThrow(
      /Permit\.nonce/,
    );
  });
});
