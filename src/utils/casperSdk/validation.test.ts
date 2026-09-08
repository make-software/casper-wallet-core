import { KeyAlgorithm, PrivateKey, PublicKey } from 'casper-js-sdk';
import { isValidCasperPublicKey } from './validation';

describe('isValidCasperPublicKey', () => {
  it('accepts real ed25519 and secp256k1 keys', () => {
    const ed = PrivateKey.generate(KeyAlgorithm.ED25519).publicKey.toHex();
    const secp = PrivateKey.generate(KeyAlgorithm.SECP256K1).publicKey.toHex();
    expect(isValidCasperPublicKey(ed)).toBe(true);
    expect(isValidCasperPublicKey(secp)).toBe(true);
  });

  it('rejects wrong length / non-hex / empty', () => {
    expect(isValidCasperPublicKey('01' + 'a'.repeat(62))).toBe(false);
    expect(isValidCasperPublicKey('zz' + 'a'.repeat(64))).toBe(false);
    expect(isValidCasperPublicKey('')).toBe(false);
  });

  it('returns false, without throwing, when the correctly-shaped hex is rejected by the SDK', () => {
    // `PublicKey.fromHex` has no reachable curve-rejection input, so the throwing branch is
    // forced directly.
    jest.spyOn(PublicKey, 'fromHex').mockImplementationOnce(() => {
      throw new Error('not a point on the curve');
    });
    const wellFormed = PrivateKey.generate(KeyAlgorithm.SECP256K1).publicKey.toHex();
    expect(isValidCasperPublicKey(wellFormed)).toBe(false);
  });
});
