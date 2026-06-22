import { PrivateKey, KeyAlgorithm } from 'casper-js-sdk';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { PermitTypes, buildDomain, fromHex } from '@casper-ecosystem/casper-eip-712';
import { computeTypedDataEIP712Digest } from './digest';
import {
  signTypedDataEIP712,
  signTypedDataEIP712DigestWithKey,
  signTypedDataEIP712WithRawKey,
} from './sign';

const DOMAIN = buildDomain('CasperSwap', '1', 'casper', '0x' + '01'.repeat(32));
const MESSAGE = {
  owner: '0x00' + '02'.repeat(32),
  spender: '0x01' + '03'.repeat(32),
  value: 1000n,
  nonce: 0n,
  deadline: 1999999999n,
};
const TYPED_DATA = { domain: DOMAIN, types: PermitTypes, primaryType: 'Permit', message: MESSAGE };
const SCALAR_HEX = '11'.repeat(32);
const EXPECTED_DIGEST = '0x545a8088d6365ada6ef282f4d5979c655cd428b4115cbf65f561bcd65767a98c';
const EXPECTED_SECP_SIG =
  '02acebd9d168c39959011754c86c70ebb2dbf122c8f9f22e915c2300a1f256757876728402a1ba9cb5de947ac1d148a3552321741abc43f2e67fbd3a94a0e0a5cb';

describe('signTypedDataEIP712DigestWithKey (secp256k1)', () => {
  it('matches the reference secp256k1.sign(sha256(digest)) byte-for-byte (no double hash)', () => {
    const key = PrivateKey.fromHex(SCALAR_HEX, KeyAlgorithm.SECP256K1);
    const result = signTypedDataEIP712DigestWithKey(key, EXPECTED_DIGEST);

    const reference =
      '02' +
      Buffer.from(
        secp256k1.sign(sha256(fromHex(EXPECTED_DIGEST)), fromHex(SCALAR_HEX)).toCompactRawBytes(),
      ).toString('hex');

    expect(result.signature).toBe(reference);
    expect(result.signature).toBe(EXPECTED_SECP_SIG);
    expect(result.digest).toBe(EXPECTED_DIGEST);
    expect(result.publicKey).toBe(key.publicKey.toHex());
  });
});

describe('signTypedDataEIP712WithRawKey (ed25519)', () => {
  it('produces a 01-prefixed signature that round-trips via the native key', () => {
    const scalar = fromHex('22'.repeat(32));
    const result = signTypedDataEIP712WithRawKey(scalar, 'ed25519', EXPECTED_DIGEST);

    expect(result.signature.startsWith('01')).toBe(true);

    const key = PrivateKey.fromHex('22'.repeat(32), KeyAlgorithm.ED25519);
    const sigBytes = Uint8Array.from(Buffer.from(result.signature, 'hex'));
    expect(key.publicKey.verifySignature(fromHex(EXPECTED_DIGEST), sigBytes)).toBe(true);
  });
});

describe('signTypedDataEIP712 (end-to-end)', () => {
  it('computes digest then signs, attaching artifacts when requested', () => {
    const key = PrivateKey.fromHex(SCALAR_HEX, KeyAlgorithm.SECP256K1);
    const result = signTypedDataEIP712(TYPED_DATA, key, { returnHashArtifacts: true });

    expect(result.digest).toBe(EXPECTED_DIGEST);
    expect(result.signature).toBe(EXPECTED_SECP_SIG);
    expect(result.hashArtifacts?.typeHash).toBe(
      '0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9',
    );

    const { digest } = computeTypedDataEIP712Digest(TYPED_DATA);
    expect(result.digest).toBe(digest);
  });

  it('omits hashArtifacts when not requested', () => {
    const key = PrivateKey.fromHex(SCALAR_HEX, KeyAlgorithm.SECP256K1);
    const result = signTypedDataEIP712(TYPED_DATA, key);
    expect(result.hashArtifacts).toBeUndefined();
    expect(result.signature).toBe(EXPECTED_SECP_SIG);
  });
});
