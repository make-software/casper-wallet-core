import { decodeEip712Address } from './address';

const HASH = 'a'.repeat(64);

describe('decodeEip712Address', () => {
  it('decodes a 0x00-tagged account address', () => {
    expect(decodeEip712Address('00' + HASH)).toEqual({ kind: 'account', hash: HASH });
    expect(decodeEip712Address('0x00' + HASH)).toEqual({ kind: 'account', hash: HASH });
  });
  it('decodes a 0x01-tagged package address', () => {
    expect(decodeEip712Address('01' + HASH)).toEqual({ kind: 'package', hash: HASH });
  });
  it('treats a bare 32-byte hash as an account', () => {
    expect(decodeEip712Address(HASH)).toEqual({ kind: 'account', hash: HASH });
    expect(decodeEip712Address('0x' + HASH)).toEqual({ kind: 'account', hash: HASH });
  });
  it('returns unknown for an unrecognized tag or wrong length', () => {
    expect(decodeEip712Address('02' + HASH)).toEqual({ kind: 'unknown', hash: null });
    expect(decodeEip712Address('ab'.repeat(20))).toEqual({ kind: 'unknown', hash: null });
    expect(decodeEip712Address('not-an-address')).toEqual({ kind: 'unknown', hash: null });
    expect(decodeEip712Address('')).toEqual({ kind: 'unknown', hash: null });
  });
  it('is case-insensitive on the hex body', () => {
    expect(decodeEip712Address('00' + 'A'.repeat(64))).toEqual({ kind: 'account', hash: HASH });
  });
});
