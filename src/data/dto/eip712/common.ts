import { IEIP712Field, IEIP712TypedData } from '../../../domain';
import { Maybe } from '../../../typings';
import { getHashByType } from '../common';
import { decodeEip712Address } from '../../../utils/eip712';

/**
 * The EIP-712 domain key carrying the chain name. It is promoted to the dedicated
 * `IEIP712SignatureRequest.chainName` field (and surfaced as a synthetic "Network" row by consumers),
 * so it is excluded from the generic `domainRows` to avoid showing the same value twice. Keep the
 * promote-and-exclude sites in sync via this single constant.
 */
export const EIP712_CHAIN_NAME_KEY = 'chain_name';

/** Strip an optional `0x` prefix. */
export const stripHexPrefix = (value: string): string =>
  value.startsWith('0x') ? value.slice(2) : value;

/**
 * Account hashes to resolve for a typed-data request: every account-tagged (`0x00`) `address`-typed
 * field value across the domain and the primary-type message, plus the signing key's account hash.
 * Package-tagged (`0x01`) and unknown-tagged addresses are excluded — those are collected separately
 * by `getPackageHashesFromTypedDataEIP712`. Deduplicated; null/empty results dropped.
 */
export const getAccountHashesFromTypedDataEIP712 = (
  typedData: IEIP712TypedData,
  signingPublicKeyHex: string,
): string[] => {
  const hashes: Array<Maybe<string>> = [];

  const collect = (fields: IEIP712Field[] | undefined, source: Record<string, unknown>) => {
    (fields ?? []).forEach(({ name, type }) => {
      const value = source[name];
      if (type === 'address' && typeof value === 'string' && value) {
        const decoded = decodeEip712Address(value);
        if (decoded.kind === 'account') {
          hashes.push(decoded.hash);
        }
      }
    });
  };

  collect(typedData.types.EIP712Domain, typedData.domain);
  collect(typedData.types[typedData.primaryType], typedData.message);
  hashes.push(getHashByType(signingPublicKeyHex, 'publicKey'));

  return Array.from(new Set(hashes.filter((h): h is string => Boolean(h))));
};

/**
 * Package hashes to resolve for a typed-data request: the domain `contract_package_hash` (stripped
 * of `0x`) plus every package-tagged (`0x01`) `address`-typed field value in the primary-type message.
 * Deduplicated; null/empty results dropped.
 */
export const getPackageHashesFromTypedDataEIP712 = (typedData: IEIP712TypedData): string[] => {
  const hashes: Array<Maybe<string>> = [];

  const domainPackage = typedData.domain.contract_package_hash;
  if (typeof domainPackage === 'string' && domainPackage) {
    hashes.push(stripHexPrefix(domainPackage));
  }

  (typedData.types[typedData.primaryType] ?? []).forEach(({ name, type }) => {
    const value = typedData.message[name];
    if (type === 'address' && typeof value === 'string' && value) {
      const decoded = decodeEip712Address(value);
      if (decoded.kind === 'package') {
        hashes.push(decoded.hash);
      }
    }
  });

  return Array.from(new Set(hashes.filter((h): h is string => Boolean(h))));
};
