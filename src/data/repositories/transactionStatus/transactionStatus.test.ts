import { firstValueFrom } from 'rxjs';

import { TransactionStatusRepository } from './index';

import { createCasperRpcClient } from '../../../utils/casperSdk/rpcClient';

import {
  DEFAULT_SETTLEMENT_POLL_INTERVAL_MS,
  isTransactionTimeoutError,
  TransactionStatusError,
} from '../../../domain/transactionStatus';
import type { CasperNetwork } from '../../../domain';

jest.mock('../../../utils/casperSdk/rpcClient', () => ({
  createCasperRpcClient: jest.fn(),
}));

const createCasperRpcClientMock = jest.mocked(createCasperRpcClient);

const NETWORK: CasperNetwork = 'testnet';
const HASH = 'aa'.repeat(32);
const GRPC_URL = { mainnet: 'm', testnet: 't', devnet: 'd', integration: 'i' } as Record<
  CasperNetwork,
  string
>;

const settled = (blockHeight: number, errorMessage?: string) => ({
  executionInfo: { blockHeight, executionResult: { errorMessage } },
});

const pending = () => ({ executionInfo: undefined });

const rpcError = (code: number) => Object.assign(new Error(`rpc ${code}`), { code });

/** Installs a fake RpcClient whose lookups resolve/reject from `steps`, in order. */
const installRpc = (steps: Array<() => Promise<unknown>>) => {
  let call = 0;
  const next = () => steps[Math.min(call++, steps.length - 1)]();
  const client = {
    getTransactionByTransactionHash: jest.fn(next),
    getTransactionByDeployHash: jest.fn(next),
  };

  createCasperRpcClientMock.mockReturnValue(client as never);

  return client;
};

const makeRepository = () => new TransactionStatusRepository(GRPC_URL, {});

const params = (over: Partial<{ isDeploy: boolean; timeoutMs: number }> = {}) => ({
  hash: HASH,
  network: NETWORK,
  isDeploy: false,
  pollIntervalMs: 5,
  timeoutMs: 500,
  ...over,
});

describe('TransactionStatusRepository', () => {
  it('emits a success outcome when the transaction executed without an error message', async () => {
    installRpc([async () => settled(42)]);

    await expect(makeRepository().waitForTransaction(params())).resolves.toEqual({
      hash: HASH,
      status: 'success',
      blockHeight: 42,
    });
  });

  it('emits a failure outcome carrying the node error message when execution reverted', async () => {
    installRpc([async () => settled(43, 'User error: 65534')]);

    await expect(makeRepository().waitForTransaction(params())).resolves.toEqual({
      hash: HASH,
      status: 'failure',
      blockHeight: 43,
      errorMessage: 'User error: 65534',
    });
  });

  it('keeps polling while the transaction is accepted but not yet executed', async () => {
    const client = installRpc([
      async () => pending(),
      async () => pending(),
      async () => settled(7),
    ]);

    await expect(makeRepository().waitForTransaction(params())).resolves.toEqual({
      hash: HASH,
      status: 'success',
      blockHeight: 7,
    });
    expect(client.getTransactionByTransactionHash).toHaveBeenCalledTimes(3);
  });

  it.each([
    ['NoSuchDeploy', -32000],
    ['NoSuchTransaction', -32014],
  ])('treats a %s rejection as still pending', async (_name, code) => {
    installRpc([
      async () => {
        throw rpcError(code);
      },
      async () => settled(9),
    ]);

    await expect(makeRepository().waitForTransaction(params())).resolves.toEqual({
      hash: HASH,
      status: 'success',
      blockHeight: 9,
    });
  });

  it('retries a transient lookup failure within the same poll tick', async () => {
    installRpc([
      async () => {
        throw new Error('socket hang up');
      },
      async () => {
        throw new Error('socket hang up');
      },
      async () => settled(11),
    ]);

    await expect(
      makeRepository().waitForTransaction(params({ timeoutMs: 2_500 })),
    ).resolves.toEqual({
      hash: HASH,
      status: 'success',
      blockHeight: 11,
    });
  });

  it('errors with a lookup TransactionStatusError when the node never answers', async () => {
    installRpc([
      async () => {
        throw new Error('ECONNREFUSED');
      },
    ]);

    await expect(makeRepository().waitForTransaction(params())).rejects.toBeInstanceOf(
      TransactionStatusError,
    );
  });

  it('errors with a timeout — not a failure outcome — when the transaction never executes', async () => {
    installRpc([async () => pending()]);

    const error = await makeRepository()
      .waitForTransaction(params({ timeoutMs: 60 }))
      .catch((e: unknown) => e);

    expect(isTransactionTimeoutError(error)).toBe(true);
    expect((error as { hash: string }).hash).toBe(HASH);
    expect((error as { type: string }).type).toBe('timeout');
  });

  it('looks a legacy deploy up by deploy hash and never by transaction hash', async () => {
    const client = installRpc([async () => settled(1)]);

    await makeRepository().waitForTransaction(params({ isDeploy: true }));

    expect(client.getTransactionByDeployHash).toHaveBeenCalledWith(HASH);
    expect(client.getTransactionByTransactionHash).not.toHaveBeenCalled();
  });

  it('looks a TransactionV1 up by transaction hash and never by deploy hash', async () => {
    const client = installRpc([async () => settled(1)]);

    await makeRepository().waitForTransaction(params({ isDeploy: false }));

    expect(client.getTransactionByTransactionHash).toHaveBeenCalledWith(HASH);
    expect(client.getTransactionByDeployHash).not.toHaveBeenCalled();
  });

  it('never runs two lookups concurrently, even when one outlives the poll interval', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    let calls = 0;

    createCasperRpcClientMock.mockReturnValue({
      getTransactionByTransactionHash: jest.fn(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise(resolve => setTimeout(resolve, 30));
        inFlight -= 1;

        return (calls += 1) < 3 ? pending() : settled(5);
      }),
      getTransactionByDeployHash: jest.fn(),
    } as never);

    await makeRepository().waitForTransaction(params({ timeoutMs: 2_000 }));

    expect(maxInFlight).toBe(1);
  });

  it('exposes the same outcome through observeTransaction', async () => {
    installRpc([async () => settled(42)]);

    await expect(firstValueFrom(makeRepository().observeTransaction(params()))).resolves.toEqual({
      hash: HASH,
      status: 'success',
      blockHeight: 42,
    });
  });

  it('defaults the poll interval when the caller omits it', () => {
    expect(DEFAULT_SETTLEMENT_POLL_INTERVAL_MS).toBe(2_000);
  });
});
