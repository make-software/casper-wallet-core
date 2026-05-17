import {
  deriveSplitDataFromNamedKeyValue,
  getAccountHashesFromDeploy,
  getCollectionHashFormDeploy,
  getDeployAmount,
  getDeployType,
  getEntryPoint,
  getKeyTypeFromResult,
  getNftTokenIdsFromArguments,
  getNftTokensQuantity,
  guardedDeriveSplitDataFromArguments,
  NamedKeyPrefix,
} from './common';
import type { IDeploy } from '../../../domain';
import { AuctionManagerContractHash, CSPRMarketContractHash } from '../../../domain';

describe('getDeployType', () => {
  it('detects AUCTION by contract_package.name', () => {
    expect(getDeployType('mainnet', { contract_package: { name: 'Auction' } as never })).toBe('AUCTION');
  });

  it('detects AUCTION by mainnet AuctionManagerContractHash', () => {
    expect(getDeployType('mainnet', { contract_hash: AuctionManagerContractHash.mainnet })).toBe('AUCTION');
  });

  it('detects CSPR_MARKET', () => {
    expect(getDeployType('mainnet', { contract_hash: CSPRMarketContractHash.mainnet })).toBe('CSPR_MARKET');
  });

  it('detects CEP18 from entry point + contract_type_id', () => {
    expect(
      getDeployType('mainnet', {
        contract_entrypoint: { name: 'transfer' } as never,
        contract_package: { contract_type_id: 2 } as never,
      }),
    ).toBe('CEP18');
  });

  it('detects NFT from entry point + NFT contract_type_id', () => {
    expect(
      getDeployType('mainnet', {
        contract_entrypoint: { name: 'transfer' } as never,
        contract_package: { contract_type_id: 4 } as never,
      }),
    ).toBe('NFT');
  });

  it('detects CSPR_NATIVE by execution_type_id 6', () => {
    expect(getDeployType('mainnet', { execution_type_id: 6 })).toBe('CSPR_NATIVE');
  });

  it('detects WASM by execution_type_id 1', () => {
    expect(getDeployType('mainnet', { execution_type_id: 1 })).toBe('WASM');
  });

  it('defaults to UNKNOWN', () => {
    expect(getDeployType('mainnet', {})).toBe('UNKNOWN');
    expect(getDeployType('mainnet', undefined)).toBe('UNKNOWN');
  });
});

describe('getDeployAmount', () => {
  it('returns 0 when amount is missing', () => {
    expect(getDeployAmount(undefined)).toBe('0');
    expect(getDeployAmount({})).toBe('0');
  });

  it('returns the parsed string', () => {
    expect(getDeployAmount({ amount: { parsed: '12345' } as never })).toBe('12345');
  });

  it('handles parsed numbers', () => {
    expect(getDeployAmount({ amount: { parsed: 42 } as never })).toBe('42');
  });

  it('returns 0 for non-primitive parsed', () => {
    expect(getDeployAmount({ amount: { parsed: { foo: 'bar' } } as never })).toBe('0');
  });
});

describe('getEntryPoint', () => {
  it('returns contract_entrypoint.name', () => {
    expect(getEntryPoint({ contract_entrypoint: { name: 'transfer' } as never })).toBe('transfer');
  });

  it('handles missing data', () => {
    expect(getEntryPoint(undefined)).toBeUndefined();
  });
});

describe('getNftTokensQuantity', () => {
  it('returns count of token_ids array', () => {
    expect(
      getNftTokensQuantity({ args: { token_ids: { parsed: ['a', 'b', 'c'] } as never } as never }),
    ).toBe(3);
  });

  it('returns 1 for a single token_id', () => {
    expect(getNftTokensQuantity({ args: { token_id: { parsed: '1' } as never } as never })).toBe(1);
  });

  it('returns null when nothing matches', () => {
    expect(getNftTokensQuantity({ args: {} as never })).toBeNull();
  });

  it('returns null when entry point is excluded', () => {
    expect(
      getNftTokensQuantity(
        { contract_entrypoint: { name: 'mint' } as never, args: { token_id: { parsed: '1' } } as never },
        ['mint'],
      ),
    ).toBeNull();
  });
});

describe('deriveSplitDataFromNamedKeyValue', () => {
  it('splits a hash- prefixed named key', () => {
    expect(deriveSplitDataFromNamedKeyValue(`${NamedKeyPrefix.HASH}abc123`)).toEqual({
      prefix: NamedKeyPrefix.HASH,
      hash: 'abc123',
    });
  });

  it('returns empty prefix when none matches', () => {
    expect(deriveSplitDataFromNamedKeyValue('plain')).toEqual({ prefix: '', hash: 'plain' });
  });
});

describe('guardedDeriveSplitDataFromArguments', () => {
  it('handles Account-typed argument', () => {
    expect(
      guardedDeriveSplitDataFromArguments({ parsed: { Account: 'account-hash-abc123' } }, 'Account'),
    ).toMatchObject({
      keyType: 'accountHash',
      hash: 'abc123',
      prefix: 'account-hash-',
    });
  });

  it('returns null when parsed[key] is not a string', () => {
    expect(guardedDeriveSplitDataFromArguments({ parsed: { Account: { nested: true } } }, 'Account')).toBeNull();
  });
});

describe('getCollectionHashFormDeploy', () => {
  it('returns contractPackageHash by default', () => {
    expect(getCollectionHashFormDeploy('mainnet', 'h', 'p', undefined)).toBe('p');
  });

  it('uses arg-derived hash when collection is a Key string', () => {
    expect(
      getCollectionHashFormDeploy('mainnet', 'h', 'p', {
        args: { collection: { cl_type: 'Key', parsed: 'hash-abc' } as never } as never,
      }),
    ).toBe('abc');
  });

  it('handles Key/Hash parsed object (hex digits after prefix → prefix stripped)', () => {
    expect(
      getCollectionHashFormDeploy('mainnet', 'h', 'p', {
        // first char after "hash-" must be hex for the prefix regex to match.
        args: { collection: { cl_type: 'Key', parsed: { Hash: 'hash-abc123' } } as never } as never,
      }),
    ).toBe('abc123');
  });
});

describe('getKeyTypeFromResult', () => {
  it('returns key_type when present', () => {
    expect(getKeyTypeFromResult({ key_type: 'publicKey' })).toBe('publicKey');
  });

  it('returns undefined otherwise', () => {
    expect(getKeyTypeFromResult({})).toBeUndefined();
    expect(getKeyTypeFromResult(null)).toBeUndefined();
  });
});

describe('getNftTokenIdsFromArguments', () => {
  it('returns empty array when no tokens', () => {
    expect(getNftTokenIdsFromArguments({} as never)).toEqual([]);
  });

  it('extracts string token ids', () => {
    expect(
      getNftTokenIdsFromArguments({ token_ids: { parsed: ['1', '2'] } } as never),
    ).toEqual(['1', '2']);
  });

  it('handles a single token_id', () => {
    expect(getNftTokenIdsFromArguments({ token_id: { parsed: '7' } } as never)).toEqual(['7']);
  });

  it('dedups', () => {
    expect(
      getNftTokenIdsFromArguments({
        token_ids: { parsed: ['1', '1', '2'] } as never,
      } as never),
    ).toEqual(['1', '2']);
  });
});

describe('getAccountHashesFromDeploy (smoke)', () => {
  it('returns empty array for an UNKNOWN deploy with no caller info', () => {
    const deploy = { type: 'UNKNOWN' } as unknown as IDeploy;
    expect(getAccountHashesFromDeploy(deploy)).toEqual([]);
  });
});
