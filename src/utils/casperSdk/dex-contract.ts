import {
  CLValue,
  Conversions,
  ParamDictionaryIdentifier,
  ParamDictionaryIdentifierContractNamedKey,
  type RpcClient,
} from 'casper-js-sdk';
import { blake2b } from '@noble/hashes/blake2';
import { concatBytes } from '@noble/hashes/utils';

/**
 * SDK-backed contract-package/dictionary helpers.
 *
 * This module value-imports `casper-js-sdk`, so it is deliberately excluded from the
 * `casperSdk` barrel (see that barrel's module comment) — only `src/data/repositories/dex`
 * should import it directly.
 */

export interface IContractHashResult {
  contractHash: string;
}

/** Resolves the active (highest-version) contract hash for a contract package. */
export const getContractHash = async (
  contractPackageHash: string,
  client: RpcClient,
): Promise<IContractHashResult> => {
  if (!contractPackageHash) {
    throw new Error('Contract package hash not found');
  }

  const {
    storedValue: { contractPackage },
  } = await client.queryLatestGlobalState(`hash-${contractPackageHash}`, []);

  if (!contractPackage) {
    throw new Error('Not found contract package');
  }

  const latestVersion = contractPackage.versions.reduce((highest, v) =>
    highest.contractVersion > v.contractVersion ? highest : v,
  );

  return {
    contractHash: latestVersion.contractHash.hash.toHex().replace('contract-', ''),
  };
};

/** Reads a dictionary value by contract-named-key identifier; `null` on any failure. */
export const getDictionaryValue = async (
  client: RpcClient,
  contractHash: string,
  dictionaryName: string,
  dictKey: string,
): Promise<CLValue | null> => {
  try {
    const identifier = new ParamDictionaryIdentifier(
      undefined,
      new ParamDictionaryIdentifierContractNamedKey(
        `hash-${contractHash}`,
        dictionaryName,
        dictKey,
      ),
    );

    const result = await client.getDictionaryItemByIdentifier(null, identifier);

    return result.storedValue?.clValue ?? null;
  } catch {
    return null;
  }
};

/** Blake2b-256 of the concatenated key bytes — the dictionary-key scheme CEP-18 contracts use. */
export const keysToHex = (keyA: CLValue, keyB: CLValue): string => {
  const blaked = blake2b(concatBytes(keyA.bytes(), keyB.bytes()), { dkLen: 32 });

  return Conversions.encodeBase16(blaked);
};
