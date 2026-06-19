import { KeyAlgorithm, PrivateKey } from 'casper-js-sdk';
import { fromHex } from '@casper-ecosystem/casper-eip-712';
import {
  EIP712SignatureScheme,
  IEIP712SignResult,
  IEIP712SignTypedDataOptions,
  IEIP712TypedData,
} from '../../domain';
import { convertBytesToHex } from '../crypto';
import { computeTypedDataDigest } from './digest';

/**
 * Sign an EIP-712 digest with a casper-js-sdk PrivateKey.
 *
 * NO DOUBLE HASH (load-bearing): casper-js-sdk's secp256k1 PrivateKey prehashes the message with
 * SHA-256 internally before signing. Passing the RAW EIP-712 digest therefore reproduces the
 * reference `secp256k1.sign(sha256(digest))` wire format byte-for-byte. Do NOT sha256 the digest
 * here. ed25519 signs the digest directly (no prehash). `signAndAddAlgorithmBytes` prepends the
 * algorithm byte: '01' for ed25519, '02' for secp256k1.
 *
 * Both schemes share the SAME `signAndAddAlgorithmBytes` call below — only casper-js-sdk's internal
 * secp256k1 path applies a SHA-256 prehash; ed25519 receives and signs the digest bytes directly
 * with NO internal prehash.
 */
export function signTypedDataEIP712DigestWithKey(
  privateKey: PrivateKey,
  digestHex: string,
): IEIP712SignResult {
  const signatureBytes = privateKey.signAndAddAlgorithmBytes(fromHex(digestHex));
  return {
    signature: convertBytesToHex(signatureBytes),
    digest: digestHex,
    publicKey: privateKey.publicKey.toHex(),
  };
}

export function signTypedDataEIP712WithRawKey(
  scalarBytes: Uint8Array,
  scheme: EIP712SignatureScheme,
  digestHex: string,
): IEIP712SignResult {
  const algorithm = scheme === 'ed25519' ? KeyAlgorithm.ED25519 : KeyAlgorithm.SECP256K1;
  const privateKey = PrivateKey.fromHex(convertBytesToHex(scalarBytes), algorithm);
  return signTypedDataEIP712DigestWithKey(privateKey, digestHex);
}

export function signTypedDataEIP712(
  typedData: IEIP712TypedData,
  privateKey: PrivateKey,
  options: IEIP712SignTypedDataOptions = {},
): IEIP712SignResult {
  const { digest, hashArtifacts } = computeTypedDataDigest(typedData, options);
  const result = signTypedDataEIP712DigestWithKey(privateKey, digest);
  return hashArtifacts ? { ...result, hashArtifacts } : result;
}
