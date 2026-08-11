import fc from 'fast-check';
import { PublicKey } from 'casper-js-sdk';

import { getAccountHashFromPublicKey } from './accountHash';

/**
 * The whole point of `accountHash.ts` is to reproduce `casper-js-sdk` byte-for-byte without
 * linking it. `casper-js-sdk` is therefore imported *here* (tests are never bundled) and used
 * as the oracle: every assertion below compares against the SDK rather than against a constant
 * we wrote down ourselves.
 */
const sdkAccountHash = (publicKey: string) => PublicKey.fromHex(publicKey).accountHash().toHex();

const hex = (byteLength: number) =>
  fc
    .uint8Array({ minLength: byteLength, maxLength: byteLength })
    .map(bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(''));

const ED25519_KEY = '0106956df3aba7115e28271d053205ec7f33cab259f8e2da2f38150f0ece65a2a8';
const SECP256K1_KEY = '0202e99759649fa63a72c685b72e696b30c90f1deabb02d0d9b1de45eb371a73e5bb';

describe('getAccountHashFromPublicKey', () => {
  describe('parity with casper-js-sdk', () => {
    it('matches the SDK for a known ED25519 key', () => {
      expect(getAccountHashFromPublicKey(ED25519_KEY)).toBe(sdkAccountHash(ED25519_KEY));
    });

    it('matches the SDK for a known SECP256K1 key', () => {
      expect(getAccountHashFromPublicKey(SECP256K1_KEY)).toBe(sdkAccountHash(SECP256K1_KEY));
    });

    it('matches the SDK for arbitrary ED25519 keys', () => {
      fc.assert(
        fc.property(hex(32), keyHex => {
          const publicKey = `01${keyHex}`;
          expect(getAccountHashFromPublicKey(publicKey)).toBe(sdkAccountHash(publicKey));
        }),
      );
    });

    it('matches the SDK for arbitrary SECP256K1 keys', () => {
      fc.assert(
        fc.property(hex(33), keyHex => {
          const publicKey = `02${keyHex}`;
          expect(getAccountHashFromPublicKey(publicKey)).toBe(sdkAccountHash(publicKey));
        }),
      );
    });

    it('accepts upper-case hex, like the SDK, and hashes it identically', () => {
      const upperCased = `01${ED25519_KEY.slice(2).toUpperCase()}`;

      expect(getAccountHashFromPublicKey(upperCased)).toBe(sdkAccountHash(upperCased));
      expect(getAccountHashFromPublicKey(upperCased)).toBe(
        getAccountHashFromPublicKey(ED25519_KEY),
      );
    });

    it('returns lower-case hex with no "account-hash-" prefix', () => {
      expect(getAccountHashFromPublicKey(ED25519_KEY)).toMatch(/^[0-9a-f]{64}$/);
    });

    /**
     * `PublicKey.fromHex` validates the hex shape only — it builds the key through
     * `PublicKey.fromBuffer`, which calls the ED25519/SECP256K1 constructors directly and never
     * the `fromBytes` factories that do curve-point checks. A key that is not a point on the
     * curve therefore hashes fine in the SDK, and must hash fine here too: diverging would mean
     * this helper and the SDK disagree on an account hash, which is exactly the failure mode
     * (funds to the wrong address) the parity requirement exists to prevent.
     */
    it('hashes structurally valid but non-curve-point keys exactly like the SDK', () => {
      const notOnCurve = `02${'00'.repeat(33)}`;

      expect(getAccountHashFromPublicKey(notOnCurve)).toBe(sdkAccountHash(notOnCurve));
    });
  });

  describe('rejects what the SDK rejects', () => {
    it.each([
      ['empty string', ''],
      ['single character', '0'],
      ['non-hex characters', 'not-hex'],
      ['prefix only', '01'],
      ['unknown algorithm prefix', `03${'aa'.repeat(32)}`],
      ['ED25519 key one byte short', `01${'aa'.repeat(31)}`],
      ['ED25519 key one byte long', `01${'aa'.repeat(33)}`],
      ['SECP256K1 key with an ED25519 length', `02${'aa'.repeat(32)}`],
      ['non-hex body', `01${'zz'.repeat(32)}`],
      ['0x-prefixed hex', `0x01${'aa'.repeat(32)}`],
      ['leading whitespace', ` 01${'aa'.repeat(32)}`],
    ])('throws on %s, with the same message as the SDK', (_label, publicKey) => {
      let sdkMessage = '';
      expect(() => {
        try {
          sdkAccountHash(publicKey);
        } catch (error) {
          sdkMessage = (error as Error).message;
          throw error;
        }
      }).toThrow();

      expect(() => getAccountHashFromPublicKey(publicKey)).toThrow(sdkMessage);
    });

    it('throws rather than hashing garbage for arbitrary non-key strings', () => {
      fc.assert(
        fc.property(
          fc.string().filter(value => !/^0(1[0-9a-fA-F]{64}|2[0-9a-fA-F]{66})$/.test(value)),
          value => {
            expect(() => getAccountHashFromPublicKey(value)).toThrow();
          },
        ),
      );
    });
  });
});
