import { blake2b } from '@noble/hashes/blake2';
import { bytesToHex, concatBytes, hexToBytes, utf8ToBytes } from '@noble/hashes/utils';

/**
 * SDK-free account hash derivation.
 *
 * This module deliberately imports nothing but `@noble/hashes` (already in the wallet bundle):
 * `getAccountHashFromPublicKey` runs synchronously during the wallet home render, so it cannot be
 * deferred behind a dynamic import, and a single `casper-js-sdk` import costs the whole prebuilt
 * UMD blob. Keep it dependency-free — do not add repo-internal imports here.
 *
 * Parity with `PublicKey.fromHex(hex).accountHash().toHex()` is a hard requirement and is enforced
 * by `accountHash.test.ts`, which uses the SDK itself as the oracle. An account hash that differs
 * from the SDK's would send funds to the wrong address.
 */

// PublicKey casper nomenclature:
// - public key = base16 hex => algo prefix + public key hex
// - account hash - internal representation of a public key with a fixed length

// base16 hex: '01deba7173738a7f55de3ad9dc27e081df41ff285f25887ec424a8a65b43d0cf77'
// base64 "2qdt4zi/b/uagi2L9Y+db0I0Jt62CTpR/Td9HhiRAu0="

// ED = 01 public keys should be 66 chars long (with the prefix)
// SEC = 02 public keys should be 68 chars long (with the prefix)

/** `blake2b-256`, the digest size the Casper account hash uses. */
const ACCOUNT_HASH_LENGTH = 32;

/**
 * The exact shape check `PublicKey.fromHex` performs: `01` + 32 bytes (ED25519), or `02` + 33
 * bytes (SECP256K1), upper- or lower-case.
 *
 * Note that the SDK does *not* verify the key is a point on the curve here — `fromHex` delegates
 * to `PublicKey.fromBuffer`, which calls the per-algorithm constructors, not the `fromBytes`
 * factories that would check. Adding a curve check would make this helper reject keys the SDK
 * accepts, i.e. break parity, so the validation stops exactly where the SDK's does.
 */
const PUBLIC_KEY_HEX_PATTERN = /^0(1[0-9a-fA-F]{64}|2[0-9a-fA-F]{66})$/;

/**
 * Lower-cased `KeyAlgorithm` names, keyed by the algorithm prefix of the public key hex. These
 * strings are hashed as part of the account hash preimage, so they must match the SDK's
 * `KeyAlgorithm[cryptoAlg].toLowerCase()` exactly.
 */
const ALGORITHM_NAME_BY_PREFIX: Record<string, string> = {
  '01': 'ed25519',
  '02': 'secp256k1',
};

const SEPARATOR_BYTE = new Uint8Array([0]);

/**
 * Derives the account hash for a public key: `blake2b-256(algorithmName ‖ 0x00 ‖ publicKeyBytes)`.
 *
 * Byte-for-byte equivalent to `PublicKey.fromHex(publicKey).accountHash().toHex()`, without
 * linking `casper-js-sdk`.
 *
 * @param publicKey - Public key as base16 hex including the algorithm prefix — `01` + 64 chars for
 *   ED25519, `02` + 66 chars for SECP256K1.
 * @returns The account hash as lower-case hex, unprefixed (no `account-hash-`).
 * @throws If `publicKey` is not a well-formed prefixed public key hex string. Error messages match
 *   the SDK's.
 */
export const getAccountHashFromPublicKey = (publicKey: string): string => {
  if (publicKey.length < 2) {
    throw new Error('Public key error: too short');
  }

  if (!PUBLIC_KEY_HEX_PATTERN.test(publicKey)) {
    throw new Error('Invalid public key');
  }

  const algorithmName = ALGORITHM_NAME_BY_PREFIX[publicKey.slice(0, 2)];
  const publicKeyBytes = hexToBytes(publicKey.slice(2));

  const preimage = concatBytes(utf8ToBytes(algorithmName), SEPARATOR_BYTE, publicKeyBytes);

  return bytesToHex(blake2b(preimage, { dkLen: ACCOUNT_HASH_LENGTH }));
};
