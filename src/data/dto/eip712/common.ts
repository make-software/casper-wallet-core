import { IEIP712Field, IEIP712TypedData } from '../../../domain';
import { Maybe } from '../../../typings';
import { getHashByType } from '../common';

/**
 * Account hashes to resolve for a typed-data request: every `address`-typed field value across the
 * domain and the primary-type message (as account hashes), plus the signing key (as a public key).
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
        hashes.push(getHashByType(value, 'accountHash'));
      }
    });
  };

  collect(typedData.types.EIP712Domain, typedData.domain);
  collect(typedData.types[typedData.primaryType], typedData.message);
  hashes.push(getHashByType(signingPublicKeyHex, 'publicKey'));

  return Array.from(new Set(hashes.filter((h): h is string => Boolean(h))));
};
