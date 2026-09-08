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

/**
 * `ErrorCode.QueryFailed` / `ErrorCode.FailedToGetDictionaryURef` — the node answered and the
 * item is not in state. Anything else (transport, HTTP, a node error) is a failed read.
 */
const ABSENT_DICTIONARY_RPC_CODES = [-32003, -32010];

/**
 * The sdk reports an RPC error as `HttpError(code, RpcError)`, so the code sits on `statusCode`
 * and on the wrapped `sourceErr` — never on the thrown error itself.
 */
const isAbsentDictionaryError = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const { code, statusCode, sourceErr } = error as {
    code?: unknown;
    statusCode?: unknown;
    sourceErr?: { code?: unknown };
  };

  return [code, statusCode, sourceErr?.code]
    .filter(value => value != null)
    .map(Number)
    .some(value => ABSENT_DICTIONARY_RPC_CODES.includes(value));
};

/**
 * Reads a dictionary value by contract-named-key identifier.
 *
 * `null` means the entry is absent. A failed read — unreachable node, HTTP error, malformed
 * response — throws rather than reading as absent.
 */
export const getDictionaryValue = async (
  client: RpcClient,
  contractHash: string,
  dictionaryName: string,
  dictKey: string,
): Promise<CLValue | null> => {
  const identifier = new ParamDictionaryIdentifier(
    undefined,
    new ParamDictionaryIdentifierContractNamedKey(`hash-${contractHash}`, dictionaryName, dictKey),
  );

  try {
    const result = await client.getDictionaryItemByIdentifier(null, identifier);

    return result.storedValue?.clValue ?? null;
  } catch (error) {
    if (isAbsentDictionaryError(error)) {
      return null;
    }

    throw error;
  }
};

/** Blake2b-256 of the concatenated key bytes — the dictionary-key scheme CEP-18 contracts use. */
export const keysToHex = (keyA: CLValue, keyB: CLValue): string => {
  const blaked = blake2b(concatBytes(keyA.bytes(), keyB.bytes()), { dkLen: 32 });

  return Conversions.encodeBase16(blaked);
};
