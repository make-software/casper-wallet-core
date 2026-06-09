import { IEIP712Field, IEIP712TypedData } from '../../../domain';
import { Maybe } from '../../../typings';
import { getHashByType } from '../common';

/** Strip an optional `0x` prefix. */
export const stripHexPrefix = (value: string): string =>
  value.startsWith('0x') ? value.slice(2) : value;

/**
 * Resolve an EIP-712 `address` field value to a Casper account hash. The value may be a Casper public
 * key (01/02-prefixed, 66/68 hex) or an account hash (64 hex), with an optional `0x` prefix. Returns
 * null when it cannot be resolved.
 */
export const resolveEip712AddressToAccountHash = (rawValue: string): Maybe<string> => {
  const value = stripHexPrefix(String(rawValue));
  const isPublicKey =
    (value.startsWith('01') && value.length === 66) ||
    (value.startsWith('02') && value.length === 68);
  return getHashByType(value, isPublicKey ? 'publicKey' : 'accountHash');
};

/**
 * Account hashes to resolve for a typed-data request: every `address`-typed field value across the
 * domain and the primary-type message (resolved to account hashes), plus the signing key.
 * Deduplicated; null/empty results dropped.
 */
export const getAccountHashesFromTypedData = (
  typedData: IEIP712TypedData,
  signingPublicKeyHex: string,
): string[] => {
  const hashes: Array<Maybe<string>> = [];

  const collect = (fields: IEIP712Field[] | undefined, source: Record<string, unknown>) => {
    (fields ?? []).forEach(({ name, type }) => {
      const value = source[name];
      if (type === 'address' && typeof value === 'string' && value) {
        hashes.push(resolveEip712AddressToAccountHash(value));
      }
    });
  };

  collect(typedData.types.EIP712Domain, typedData.domain);
  collect(typedData.types[typedData.primaryType], typedData.message);
  hashes.push(getHashByType(signingPublicKeyHex, 'publicKey'));

  return Array.from(new Set(hashes.filter((h): h is string => Boolean(h))));
};
