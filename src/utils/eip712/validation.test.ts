import fc from 'fast-check';
import { CASPER_DOMAIN_TYPES, PermitTypes, buildDomain } from '@casper-ecosystem/casper-eip-712';
import { EIP712Error, IEIP712Types, SignTypedDataErrorCodes } from '../../domain';
import {
  resolveDomainTypes,
  validateNoUnknownMessageFields,
  validatePrimaryType,
  validateTypedDataEIP712FieldTypes,
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
