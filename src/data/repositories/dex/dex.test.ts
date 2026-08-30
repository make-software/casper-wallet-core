import { DexContractRepository } from './index';
import {
  DexError,
  TradeContractPackageHash,
  WrappedCsprContractPackageHash,
} from '../../../domain';

const mockSetReferrer = jest.fn();
const mockSetCustomHeaders = jest.fn();
const mockHttpHandlerCtor = jest.fn();

jest.mock('casper-js-sdk', () => ({
  ...jest.requireActual('casper-js-sdk'),
  HttpHandler: class {
    constructor(...args: unknown[]) {
      mockHttpHandlerCtor(...args);
    }
    setReferrer = mockSetReferrer;
    setCustomHeaders = mockSetCustomHeaders;
  },
}));

const PUBLIC_KEY = '0106956df3aba7115e28271d053205ec7f33cab259f8e2da2f38150f0ece65a2a8';
/** blake2b-256(accountKey.bytes() ++ tradeContractKey.bytes()) for PUBLIC_KEY on mainnet. */
const ALLOWANCES_DICT_KEY = 'd3cf5c22d374ac6ec3e20c825ad6f38b47f15ba4db675ab3ab598d0fa6c03782';

const GRPC_URL = {
  mainnet: 'https://rpc.mainnet.example.com',
  testnet: 'https://rpc.testnet.example.com',
  devnet: '',
  integration: '',
};

const DEX_CONFIG = {
  tradeContractPackageHash: TradeContractPackageHash,
  wrappedCsprContractPackageHash: WrappedCsprContractPackageHash,
  gasPriceTolerance: 1,
};

/** Fake RpcClient — only the methods a given test exercises need to be present. */
const makeClient = (overrides: Record<string, jest.Mock> = {}) => overrides;

/** Stubs the private `_getClient` factory so tests can inject a fake RpcClient. */
const stubClient = (repo: DexContractRepository, client: Record<string, jest.Mock>) =>
  jest.spyOn(repo as any, '_getClient').mockReturnValue(client);

const makeVersion = (contractVersion: number, contractHashHex: string) => ({
  contractVersion,
  contractHash: { hash: { toHex: () => `contract-${contractHashHex}` } },
});

const makeQueryLatestGlobalState = (...versions: ReturnType<typeof makeVersion>[] | [string]) =>
  jest.fn().mockResolvedValue({
    storedValue: {
      contractPackage: {
        versions:
          typeof versions[0] === 'string'
            ? [makeVersion(1, versions[0])]
            : (versions as ReturnType<typeof makeVersion>[]),
      },
    },
  });

describe('DexContractRepository', () => {
  describe('getAllowance', () => {
    it('reads the allowances dictionary with a key derived from both keys (keysToHex)', async () => {
      const repo = new DexContractRepository(GRPC_URL, DEX_CONFIG);
      const getDictionaryItemByIdentifier = jest
        .fn()
        .mockResolvedValue({ storedValue: { clValue: { toString: () => '999' } } });
      stubClient(
        repo,
        makeClient({
          queryLatestGlobalState: makeQueryLatestGlobalState('def456'),
          getDictionaryItemByIdentifier,
        }),
      );

      const result = await repo.getAllowance({
        network: 'mainnet',
        contractPackageHash: 'cph',
        publicKey: PUBLIC_KEY,
      });

      expect(result).toBe('999');
      const identifier = getDictionaryItemByIdentifier.mock.calls[0][1];
      expect(identifier.contractNamedKey.dictionaryName).toBe('allowances');

      // Fixed vector rather than a re-run of `keysToHex`; the derivation itself is pinned in
      // src/utils/casperSdk/dex-contract.test.ts.
      expect(identifier.contractNamedKey.dictionaryItemKey).toBe(ALLOWANCES_DICT_KEY);
    });

    it('rejects a DexError typed "getAllowance" on RPC failure', async () => {
      const repo = new DexContractRepository(GRPC_URL, DEX_CONFIG);
      stubClient(
        repo,
        makeClient({ queryLatestGlobalState: jest.fn().mockRejectedValue(new Error('rpc down')) }),
      );

      await expect(
        repo.getAllowance({
          network: 'mainnet',
          contractPackageHash: 'cph',
          publicKey: PUBLIC_KEY,
        }),
      ).rejects.toMatchObject({ name: 'DexRepositoryError', type: 'getAllowance' });
    });

    it('resolves "" when the allowances dictionary has no entry for the spender', async () => {
      const repo = new DexContractRepository(GRPC_URL, DEX_CONFIG);
      stubClient(
        repo,
        makeClient({
          queryLatestGlobalState: makeQueryLatestGlobalState('def456'),
          getDictionaryItemByIdentifier: jest.fn().mockRejectedValue(new Error('key not found')),
        }),
      );

      await expect(
        repo.getAllowance({
          network: 'mainnet',
          contractPackageHash: 'cph',
          publicKey: PUBLIC_KEY,
        }),
      ).resolves.toBe('');
    });
  });

  describe('contract version selection', () => {
    /** Reads back the contract hash the dictionary lookup was pointed at. */
    const dictionaryTargetOf = async (
      queryLatestGlobalState: jest.Mock,
    ): Promise<string | undefined> => {
      const repo = new DexContractRepository(GRPC_URL, DEX_CONFIG);
      const getDictionaryItemByIdentifier = jest
        .fn()
        .mockResolvedValue({ storedValue: { clValue: { toString: () => '1' } } });
      stubClient(repo, makeClient({ queryLatestGlobalState, getDictionaryItemByIdentifier }));

      await repo.getAllowance({
        network: 'mainnet',
        contractPackageHash: 'cph',
        publicKey: PUBLIC_KEY,
      });

      return getDictionaryItemByIdentifier.mock.calls[0][1].contractNamedKey.key as string;
    };

    // A stale version's `allowances` dictionary reports an allowance the user never granted, or
    // misses one they did — either way they pay for an approval on every swap.
    it('reads the allowance from the highest contract version', async () => {
      await expect(
        dictionaryTargetOf(
          makeQueryLatestGlobalState(
            makeVersion(1, 'old'),
            makeVersion(3, 'newest'),
            makeVersion(2, 'mid'),
          ),
        ),
      ).resolves.toContain('newest');
    });

    it('does not depend on the versions arriving in order', async () => {
      await expect(
        dictionaryTargetOf(
          makeQueryLatestGlobalState(makeVersion(3, 'newest'), makeVersion(1, 'old')),
        ),
      ).resolves.toContain('newest');
    });
  });

  describe('checkApprovalRequired', () => {
    it('resolves false for WCSPR without any RPC call', async () => {
      const repo = new DexContractRepository(GRPC_URL, DEX_CONFIG);
      const getClientSpy = jest.spyOn(repo as any, '_getClient');

      const result = await repo.checkApprovalRequired({
        network: 'mainnet',
        contractPackageHash: WrappedCsprContractPackageHash.mainnet,
        publicKey: PUBLIC_KEY,
        requiredAmount: '100',
      });

      expect(result).toBe(false);
      expect(getClientSpy).not.toHaveBeenCalled();
    });

    it('resolves true when the allowance is less than the required amount', async () => {
      const repo = new DexContractRepository(GRPC_URL, DEX_CONFIG);
      jest.spyOn(repo, 'getAllowance').mockResolvedValue('100');

      await expect(
        repo.checkApprovalRequired({
          network: 'mainnet',
          contractPackageHash: 'cph',
          publicKey: PUBLIC_KEY,
          requiredAmount: '200',
        }),
      ).resolves.toBe(true);
    });

    it('resolves false when the allowance equals the required amount', async () => {
      const repo = new DexContractRepository(GRPC_URL, DEX_CONFIG);
      jest.spyOn(repo, 'getAllowance').mockResolvedValue('200');

      await expect(
        repo.checkApprovalRequired({
          network: 'mainnet',
          contractPackageHash: 'cph',
          publicKey: PUBLIC_KEY,
          requiredAmount: '200',
        }),
      ).resolves.toBe(false);
    });

    it('resolves true (assumes approval required) when the allowance read rejects', async () => {
      const repo = new DexContractRepository(GRPC_URL, DEX_CONFIG);
      jest.spyOn(repo, 'getAllowance').mockRejectedValue(new Error('rpc down'));

      await expect(
        repo.checkApprovalRequired({
          network: 'mainnet',
          contractPackageHash: 'cph',
          publicKey: PUBLIC_KEY,
          requiredAmount: '200',
        }),
      ).resolves.toBe(true);
    });
  });

  describe('getLatestBlockTime', () => {
    it('resolves the latest block timestamp in ms', async () => {
      const repo = new DexContractRepository(GRPC_URL, DEX_CONFIG);
      stubClient(
        repo,
        makeClient({
          getLatestBlock: jest
            .fn()
            .mockResolvedValue({ block: { timestamp: { toMilliseconds: () => 1700000000000 } } }),
        }),
      );

      await expect(repo.getLatestBlockTime({ network: 'mainnet' })).resolves.toBe(1700000000000);
    });

    it('rejects a DexError typed "getLatestBlockTime" on RPC failure', async () => {
      const repo = new DexContractRepository(GRPC_URL, DEX_CONFIG);
      stubClient(
        repo,
        makeClient({ getLatestBlock: jest.fn().mockRejectedValue(new Error('rpc down')) }),
      );

      await expect(repo.getLatestBlockTime({ network: 'mainnet' })).rejects.toMatchObject({
        name: 'DexRepositoryError',
        type: 'getLatestBlockTime',
      });
    });
  });

  describe('error wrapping', () => {
    it('rethrows an inner DexError as-is, without re-wrapping its type', async () => {
      const repo = new DexContractRepository(GRPC_URL, DEX_CONFIG);
      const inner = new DexError(new Error('inner failure'), 'getAllowance');
      stubClient(repo, makeClient({ getLatestBlock: jest.fn().mockRejectedValue(inner) }));

      await expect(repo.getLatestBlockTime({ network: 'mainnet' })).rejects.toBe(inner);
    });
  });

  describe('_getClient', () => {
    beforeEach(() => jest.clearAllMocks());

    it("default rpc options: 'fetch' handler + setReferrer, no Referer header", () => {
      const repo = new DexContractRepository(GRPC_URL, DEX_CONFIG);
      (repo as any)._getClient('mainnet');
      expect(mockHttpHandlerCtor).toHaveBeenCalledWith(GRPC_URL.mainnet, 'fetch');
      expect(mockSetReferrer).toHaveBeenCalledWith('https://casperwallet.io');
      expect(mockSetCustomHeaders).not.toHaveBeenCalled();
    });

    it("mobile rpc options: 'axios' handler + literal Referer header (+auth)", () => {
      const repo = new DexContractRepository(GRPC_URL, DEX_CONFIG, 'token', {
        handlerType: 'axios',
        referrerMode: 'referer-header',
      });
      (repo as any)._getClient('mainnet');
      expect(mockHttpHandlerCtor).toHaveBeenCalledWith(GRPC_URL.mainnet, 'axios');
      expect(mockSetCustomHeaders).toHaveBeenCalledWith({
        Referer: 'https://casperwallet.io',
        Authorization: 'token',
      });
      expect(mockSetReferrer).not.toHaveBeenCalled();
    });
  });
});
