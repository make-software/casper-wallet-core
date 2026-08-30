import { CLValue, Key, PublicKey } from 'casper-js-sdk';

import { DexContractRepository } from './index';
import { keysToHex } from '../../../utils/casperSdk/dex-contract';
import {
  DexError,
  TradeContractPackageHash,
  WrappedCsprContractPackageHash,
} from '../../../domain';

const PUBLIC_KEY = '0106956df3aba7115e28271d053205ec7f33cab259f8e2da2f38150f0ece65a2a8';

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

const makeQueryLatestGlobalState = (contractHashHex: string) =>
  jest.fn().mockResolvedValue({
    storedValue: {
      contractPackage: {
        versions: [
          {
            contractVersion: 1,
            contractHash: { hash: { toHex: () => `contract-${contractHashHex}` } },
          },
        ],
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

      const accountKey = CLValue.newCLKey(
        Key.newKey(PublicKey.fromHex(PUBLIC_KEY).accountHash().toPrefixedString()),
      );
      const operatorKey = CLValue.newCLKey(Key.newKey(TradeContractPackageHash.mainnet));
      expect(identifier.contractNamedKey.dictionaryItemKey).toBe(
        keysToHex(accountKey, operatorKey),
      );
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
});
