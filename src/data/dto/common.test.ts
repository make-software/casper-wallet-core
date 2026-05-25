import {
  ContractTypeId,
  deriveKeyType,
  dexIdToMarketDataProviderMap,
  getAccountInfoFromMap,
  getCsprFiatAmount,
  getHashByType,
  getMarketDataProviderUrl,
  getNftTokenUrlsMap,
  getPreferredTokenMarketData,
  isCep18Action,
  isNftAction,
} from './common';
import { makeAccountInfo } from '../../__test-utils__';
import type { IAccountInfo } from '../../domain';

const PUBLIC_KEY = '0106956df3aba7115e28271d053205ec7f33cab259f8e2da2f38150f0ece65a2a8';

describe('dto/common helpers', () => {
  describe('getCsprFiatAmount', () => {
    it('returns empty when rate is zero or missing', () => {
      expect(getCsprFiatAmount('1', 0)).toBe('');
      expect(getCsprFiatAmount('1')).toBe('');
    });

    it('multiplies CSPR decimal value × rate', () => {
      expect(getCsprFiatAmount('1000000000', 0.05)).toBe('$0.05');
    });
  });

  describe('deriveKeyType', () => {
    it('returns publicKey for hex with 01/02 prefix', () => {
      expect(deriveKeyType(PUBLIC_KEY)).toBe('publicKey');
    });

    it('returns accountHash otherwise', () => {
      expect(deriveKeyType('abc')).toBe('accountHash');
      expect(deriveKeyType(undefined)).toBe('accountHash');
    });
  });

  describe('getAccountInfoFromMap', () => {
    const ACCOUNT_HASH = 'a'.repeat(64);
    const map: Record<string, IAccountInfo> = {
      [ACCOUNT_HASH]: makeAccountInfo({ accountHash: ACCOUNT_HASH }),
    };

    it('looks up by accountHash', () => {
      expect(getAccountInfoFromMap(map, ACCOUNT_HASH, 'accountHash')?.accountHash).toBe(
        ACCOUNT_HASH,
      );
    });

    it('returns undefined when not found (record lookup)', () => {
      expect(getAccountInfoFromMap(map, 'unknown', 'accountHash')).toBeUndefined();
    });

    it('returns null when hash is null/undefined', () => {
      expect(getAccountInfoFromMap(map, null)).toBeNull();
    });
  });

  describe('getHashByType', () => {
    it('returns the same hash for accountHash type', () => {
      expect(getHashByType('abc', 'accountHash')).toBe('abc');
    });

    it('converts publicKey to accountHash', () => {
      const out = getHashByType(PUBLIC_KEY, 'publicKey');
      expect(out).toMatch(/^[0-9a-f]+$/);
    });

    it('returns null for an unknown type', () => {
      expect(getHashByType('abc', undefined)).toBeNull();
    });

    it('returns null on invalid publicKey', () => {
      expect(getHashByType('bogus', 'publicKey')).toBeNull();
    });

    it('returns null for missing hash', () => {
      expect(getHashByType(null, 'accountHash')).toBeNull();
    });
  });

  describe('getNftTokenUrlsMap', () => {
    it('builds a map keyed by token id', () => {
      const out = getNftTokenUrlsMap(['1', '2'], 'mainnet', 'coll');
      expect(Object.keys(out)).toEqual(['1', '2']);
      expect(out['1']).toContain('nfts/1');
    });
  });

  describe('getMarketDataProviderUrl', () => {
    it('handles CsprTrade', () => {
      expect(getMarketDataProviderUrl('CsprTrade')).toBe('https://cspr.trade/');
    });

    it('handles CoinGecko with coingeckoId', () => {
      expect(getMarketDataProviderUrl('CoinGecko', 'cspr')).toContain('coingecko.com');
    });

    it('returns null for CoinGecko without id', () => {
      expect(getMarketDataProviderUrl('CoinGecko')).toBeNull();
    });

    it('handles FriendlyMarket with latest contract hash', () => {
      expect(getMarketDataProviderUrl('FriendlyMarket', null, 'hash')).toContain('friendly.market');
    });

    it('returns null for FriendlyMarket without contract', () => {
      expect(getMarketDataProviderUrl('FriendlyMarket')).toBeNull();
    });

    it('returns null for unknown provider', () => {
      expect(getMarketDataProviderUrl(null)).toBeNull();
    });
  });

  describe('isCep18Action / isNftAction', () => {
    it('isCep18Action returns true only for cep18 contract+entrypoint', () => {
      expect(isCep18Action('transfer', ContractTypeId.Cep18)).toBe(true);
      expect(isCep18Action('TRANSFER', ContractTypeId.Cep18)).toBe(true); // case-insensitive
      expect(isCep18Action('transfer', ContractTypeId.CEP47Nft)).toBe(false);
      expect(isCep18Action('unknown', ContractTypeId.Cep18)).toBe(false);
    });

    it('isNftAction returns true for any NFT contract type', () => {
      expect(isNftAction('transfer', ContractTypeId.CEP47Nft)).toBe(true);
      expect(isNftAction('transfer', ContractTypeId.CEP78Nft)).toBe(true);
      expect(isNftAction('transfer', ContractTypeId.Cep18)).toBe(false);
    });
  });

  describe('getPreferredTokenMarketData', () => {
    it('returns null for missing input', () => {
      expect(getPreferredTokenMarketData(null)).toBeNull();
      expect(getPreferredTokenMarketData([])).toBeNull();
    });

    it('returns the entry with the lowest dex_id', () => {
      expect(
        getPreferredTokenMarketData([
          { dex_id: 3, latest_rate: 1 } as never,
          { dex_id: 1, latest_rate: 2 } as never,
        ])?.dex_id,
      ).toBe(1);
    });
  });

  describe('dexIdToMarketDataProviderMap', () => {
    it('maps the documented dex ids', () => {
      expect(dexIdToMarketDataProviderMap[1]).toBe('CsprTrade');
      expect(dexIdToMarketDataProviderMap[2]).toBe('CoinGecko');
      expect(dexIdToMarketDataProviderMap[3]).toBe('FriendlyMarket');
    });
  });
});
