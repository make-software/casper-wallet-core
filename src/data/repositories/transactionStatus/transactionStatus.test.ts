import { HttpError, RpcError } from 'casper-js-sdk';
import { firstValueFrom } from 'rxjs';

import { TransactionStatusRepository } from './index';

import { createCasperRpcClient } from '../../../utils/casperSdk/rpcClient';

import {
  DEFAULT_SETTLEMENT_POLL_INTERVAL_MS,
  DEFAULT_SETTLEMENT_TIMEOUT_MS,
  DEX_TRANSACTION_TTL_MS,
  isTransactionTimeoutError,
  isTransactionWatchCancelledError,
  TransactionStatusError,
} from '../../../domain';
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

/** The shape `RpcClient.processRequest` throws: the code rides on the wrapped `RpcError`. */
const rpcError = (code: number) => new HttpError(code, new RpcError(code, `rpc ${code}`));

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

const params = (
  over: Partial<{
    isDeploy: boolean;
    timeoutMs: number;
    lookupGraceMs: number;
    signal: AbortSignal;
  }> = {},
) => ({
  hash: HASH,
  network: NETWORK,
  isDeploy: false,
  pollIntervalMs: 5,
  timeoutMs: 500,
  ...over,
});

beforeEach(() => {
  createCasperRpcClientMock.mockClear();
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

  it('keeps polling through a run of transient lookup failures rather than ending the watch', async () => {
    let calls = 0;

    installRpc([
      async () => {
        if ((calls += 1) <= 6) {
          throw new Error('socket hang up');
        }

        return settled(11);
      },
    ]);

    await expect(
      makeRepository().waitForTransaction(params({ timeoutMs: 2_500, lookupGraceMs: 200 })),
    ).resolves.toEqual({
      hash: HASH,
      status: 'success',
      blockHeight: 11,
    });
  });

  it('errors with a lookup TransactionStatusError once the grace window of failures elapses', async () => {
    installRpc([
      async () => {
        throw new Error('ECONNREFUSED');
      },
    ]);

    const error = await makeRepository()
      .waitForTransaction(params({ lookupGraceMs: 20 }))
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(TransactionStatusError);
    expect((error as { type: string }).type).toBe('lookup');
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

  it('waits out the poll interval after a slow lookup instead of queueing missed ticks', async () => {
    const LOOKUP_MS = 60;
    const POLL_INTERVAL_MS = 50;
    const starts: number[] = [];
    let calls = 0;

    createCasperRpcClientMock.mockReturnValue({
      getTransactionByTransactionHash: jest.fn(async () => {
        starts.push(Date.now());
        await new Promise(resolve => setTimeout(resolve, LOOKUP_MS));

        return (calls += 1) < 3 ? pending() : settled(5);
      }),
      getTransactionByDeployHash: jest.fn(),
    } as never);

    await makeRepository().waitForTransaction({
      ...params({ timeoutMs: 5_000 }),
      pollIntervalMs: POLL_INTERVAL_MS,
    });

    expect(starts).toHaveLength(3);
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(LOOKUP_MS + POLL_INTERVAL_MS - 15);
    expect(starts[2] - starts[1]).toBeGreaterThanOrEqual(LOOKUP_MS + POLL_INTERVAL_MS - 15);
  });

  it('builds one rpc client per watch rather than one per poll', async () => {
    const client = installRpc([
      async () => pending(),
      async () => pending(),
      async () => settled(3),
    ]);

    await makeRepository().waitForTransaction(params());

    expect(client.getTransactionByTransactionHash).toHaveBeenCalledTimes(3);
    expect(createCasperRpcClientMock).toHaveBeenCalledTimes(1);
  });

  it('rejects with a cancellation error when the caller aborts the watch', async () => {
    installRpc([async () => pending()]);
    const controller = new AbortController();

    const promise = makeRepository()
      .waitForTransaction(params({ timeoutMs: 5_000, signal: controller.signal }))
      .catch((e: unknown) => e);

    await new Promise(resolve => setTimeout(resolve, 20));
    controller.abort();

    const error = await promise;

    expect(isTransactionWatchCancelledError(error)).toBe(true);
    expect((error as { hash: string }).hash).toBe(HASH);
  });

  it('stops polling once the watch is aborted', async () => {
    const client = installRpc([async () => pending()]);
    const controller = new AbortController();

    const promise = makeRepository()
      .waitForTransaction(params({ timeoutMs: 5_000, signal: controller.signal }))
      .catch(() => undefined);

    await new Promise(resolve => setTimeout(resolve, 30));
    controller.abort();
    await promise;

    const callsAtAbort = client.getTransactionByTransactionHash.mock.calls.length;

    await new Promise(resolve => setTimeout(resolve, 60));

    expect(client.getTransactionByTransactionHash).toHaveBeenCalledTimes(callsAtAbort);
  });

  it('rejects immediately when handed an already-aborted signal', async () => {
    const client = installRpc([async () => settled(1)]);

    const error = await makeRepository()
      .waitForTransaction(params({ signal: AbortSignal.abort() }))
      .catch((e: unknown) => e);

    expect(isTransactionWatchCancelledError(error)).toBe(true);
    expect(client.getTransactionByTransactionHash).not.toHaveBeenCalled();
  });

  it('exposes the same outcome through observeTransaction', async () => {
    installRpc([async () => settled(42)]);

    await expect(firstValueFrom(makeRepository().observeTransaction(params()))).resolves.toEqual({
      hash: HASH,
      status: 'success',
      blockHeight: 42,
    });
  });

  it('completes observeTransaction after the outcome even when a signal is supplied', async () => {
    installRpc([async () => settled(42)]);
    const controller = new AbortController();
    const seen: string[] = [];

    await new Promise<void>((resolve, reject) => {
      makeRepository()
        .observeTransaction(params({ signal: controller.signal }))
        .subscribe({
          next: () => seen.push('next'),
          error: reject,
          complete: () => {
            seen.push('complete');
            resolve();
          },
        });
    });

    expect(seen).toEqual(['next', 'complete']);
  });

  it('watches for as long as a transaction stays valid on chain', () => {
    expect(DEFAULT_SETTLEMENT_POLL_INTERVAL_MS).toBe(2_000);
    expect(DEFAULT_SETTLEMENT_TIMEOUT_MS).toBe(DEX_TRANSACTION_TTL_MS);
  });
});
