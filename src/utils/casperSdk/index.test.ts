import {
  getAccountHashFromPublicKey,
  getBlockExplorerAccountUrl,
  getBlockExplorerContractPackageUrl,
  getBlockExplorerHashUrl,
  getCasperNetworkByChainName,
  getContractNftUrl,
} from './index';
import { CasperLiveUrl } from '../../domain';

const VALID_PUBLIC_KEY = '0106956df3aba7115e28271d053205ec7f33cab259f8e2da2f38150f0ece65a2a8';

describe('casperSdk helpers', () => {
  describe('getAccountHashFromPublicKey', () => {
    it('returns a deterministic hex string for a valid public key', () => {
      const a = getAccountHashFromPublicKey(VALID_PUBLIC_KEY);
      const b = getAccountHashFromPublicKey(VALID_PUBLIC_KEY);
      expect(a).toBe(b);
      expect(a).toMatch(/^[0-9a-f]+$/);
      expect(a.length).toBeGreaterThan(0);
    });

    it('throws on an invalid public key', () => {
      expect(() => getAccountHashFromPublicKey('not-hex')).toThrow();
    });
  });

  describe('getCasperNetworkByChainName', () => {
    it.each(['mainnet', 'testnet', 'devnet', 'integration'])(
      'returns %s unchanged when already a CasperNetwork',
      network => {
        expect(getCasperNetworkByChainName(network)).toBe(network);
      },
    );

    it('maps casper chain names → CasperNetwork', () => {
      expect(getCasperNetworkByChainName('casper')).toBe('mainnet');
      expect(getCasperNetworkByChainName('casper-test')).toBe('testnet');
    });

    it('returns null for unknown chain', () => {
      expect(getCasperNetworkByChainName('bogus')).toBeNull();
    });
  });

  describe('getBlockExplorerAccountUrl', () => {
    it('builds an account URL', () => {
      expect(getBlockExplorerAccountUrl('mainnet', VALID_PUBLIC_KEY)).toBe(
        `${CasperLiveUrl.mainnet}/account/${VALID_PUBLIC_KEY}`,
      );
    });

    it('uses uref path for uref keys', () => {
      const uref = 'uref-abc';
      expect(getBlockExplorerAccountUrl('mainnet', uref)).toBe(
        `${CasperLiveUrl.mainnet}/uref/${uref}`,
      );
    });

    it('returns null for unknown network', () => {
      expect(getBlockExplorerAccountUrl('bogus', VALID_PUBLIC_KEY)).toBeNull();
    });

    it('returns null for missing accountKey', () => {
      expect(getBlockExplorerAccountUrl('mainnet', null)).toBeNull();
    });
  });

  describe('getBlockExplorerContractPackageUrl', () => {
    it('prefers contractPackageHash when both provided', () => {
      expect(getBlockExplorerContractPackageUrl('mainnet', 'pkg', 'contract')).toBe(
        `${CasperLiveUrl.mainnet}/contract-package/pkg`,
      );
    });

    it('falls back to contractHash', () => {
      expect(getBlockExplorerContractPackageUrl('mainnet', null, 'contract')).toBe(
        `${CasperLiveUrl.mainnet}/contract/contract`,
      );
    });

    it('returns null when both hashes are missing', () => {
      expect(getBlockExplorerContractPackageUrl('mainnet', null, null)).toBeNull();
    });
  });

  describe('getBlockExplorerHashUrl', () => {
    it('builds a search URL', () => {
      expect(getBlockExplorerHashUrl('mainnet', 'abc')).toBe(`${CasperLiveUrl.mainnet}/search/abc`);
    });

    it('returns null for unknown network', () => {
      expect(getBlockExplorerHashUrl('bogus', 'abc')).toBeNull();
    });
  });

  describe('getContractNftUrl', () => {
    it('builds an NFT URL', () => {
      expect(getContractNftUrl('mainnet', 'collection', '7')).toBe(
        `${CasperLiveUrl.mainnet}/contracts/collection/nfts/7`,
      );
    });

    it.each([
      ['bogus', 'collection', '7'],
      ['mainnet', null, '7'],
      ['mainnet', 'collection', ''],
    ])('returns null when something is missing (%s, %s, %s)', (chain, collection, tokenId) => {
      expect(getContractNftUrl(chain, collection as string | null, tokenId)).toBeNull();
    });
  });
});
