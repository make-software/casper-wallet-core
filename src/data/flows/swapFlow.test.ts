import { Subject, firstValueFrom, tap, toArray } from 'rxjs';

import { createSwapFlowRunner } from './swapFlow';

import { calculateApprovalAmount, calculateMaxAmountWithSlippage } from '../../utils/amounts';

import type { ITransactionOutcome } from '../../domain/transactionStatus';

import { stubDexContractRepository, TEST_PUBLIC_KEY } from '../../__test-utils__/render-hook';
import { CSPR_NATIVE_TOKEN_ID } from '../../domain/constants';
import {
  TransactionTimeoutError,
  TransactionWatchCancelledError,
} from '../../domain/transactionStatus';
import { SwapQuoteType } from '../../domain/swap';
import { LedgerError, LedgerEventStatus } from '../../domain/ledger';
import type { ILedgerEvent } from '../../domain/ledger';
import type { IDexTokenWithAmount } from '../../domain/swap';
import type { ISwapFlowDeps } from './swapFlow';

const token = (id: string): IDexTokenWithAmount =>
  ({
    id,
    packageHash: `${id}-hash`,
    decimals: 9,
    amountRaw: '1000000000',
    amountFormatted: '1',
  }) as IDexTokenWithAmount;

const BUILT_APPROVAL = { kind: 'approval', transaction: {} } as never;
const BUILT_SWAP = { kind: 'swap', transaction: {} } as never;
/** The legacy-Deploy artifact: `isDeploy` is derived from the presence of this field. */
const BUILT_SWAP_DEPLOY = { kind: 'swap', deploy: {} } as never;

const outcome = (
  hash: string,
  status: 'success' | 'failure',
  errorMessage?: string,
): ITransactionOutcome =>
  status === 'failure'
    ? { hash, status, blockHeight: 1, errorMessage }
    : { hash, status, blockHeight: 1 };

const makeDeps = (over: Partial<ISwapFlowDeps> = {}): ISwapFlowDeps => ({
  network: 'testnet',
  publicKey: TEST_PUBLIC_KEY,
  signer: { publicKeyHex: TEST_PUBLIC_KEY } as never,
  supportsTransactionV1: true,
  dexContractRepository: stubDexContractRepository({
    checkApprovalRequired: jest.fn().mockResolvedValue(false),
    buildApprovalTransaction: jest.fn().mockResolvedValue(BUILT_APPROVAL),
    buildSwapTransaction: jest.fn().mockResolvedValue(BUILT_SWAP),
  }),
  casperTransactionsRepository: {
    sendDexTransaction: jest.fn().mockResolvedValue('0xswap'),
  },
  transactionStatusRepository: {
    observeTransaction: jest.fn(),
    waitForTransaction: jest.fn(async ({ hash }: { hash: string }) => outcome(hash, 'success')),
  },
  ...over,
});

const startParams = (over = {}) => ({
  firstToken: token('cep18-in'),
  secondToken: token('cep18-out'),
  path: ['cep18-in', 'cep18-out'],
  quoteType: SwapQuoteType.ExactIn,
  slippage: 1,
  deadline: 20,
  ...over,
});

const collect = async (deps: ISwapFlowDeps, params = startParams()) => {
  const handle = createSwapFlowRunner(deps).start(params);
  const events = await firstValueFrom(handle.events$.pipe(toArray()));

  return { handle, events, types: events.map(e => e.type), result: await handle.done };
};

describe('createSwapFlowRunner', () => {
  it('skips the approval leg for a native CSPR input', async () => {
    const deps = makeDeps();
    const { types } = await collect(deps, startParams({ firstToken: token(CSPR_NATIVE_TOKEN_ID) }));

    expect(types).toEqual([
      'approval:checking',
      'approval:not-required',
      'swap:signing',
      'swap:sent',
      'swap:confirmed',
    ]);
    expect(deps.dexContractRepository.buildApprovalTransaction).not.toHaveBeenCalled();
  });

  it('skips the approval leg when the allowance already covers the trade', async () => {
    const deps = makeDeps();
    const { types } = await collect(deps);

    expect(types).toEqual([
      'approval:checking',
      'approval:not-required',
      'swap:signing',
      'swap:sent',
      'swap:confirmed',
    ]);
  });

  it('runs approval then swap, in that order, when an approval is required', async () => {
    const deps = makeDeps({
      dexContractRepository: stubDexContractRepository({
        checkApprovalRequired: jest.fn().mockResolvedValue(true),
        buildApprovalTransaction: jest.fn().mockResolvedValue(BUILT_APPROVAL),
        buildSwapTransaction: jest.fn().mockResolvedValue(BUILT_SWAP),
      }),
    });

    const { types } = await collect(deps);

    expect(types).toEqual([
      'approval:checking',
      'approval:signing',
      'approval:sent',
      'approval:confirmed',
      'swap:signing',
      'swap:sent',
      'swap:confirmed',
    ]);
  });

  it('does not build the swap until the approval has settled on chain', async () => {
    const order: string[] = [];
    const deps = makeDeps({
      dexContractRepository: stubDexContractRepository({
        checkApprovalRequired: jest.fn().mockResolvedValue(true),
        buildApprovalTransaction: jest.fn().mockResolvedValue(BUILT_APPROVAL),
        buildSwapTransaction: jest.fn(async () => {
          order.push('build-swap');

          return BUILT_SWAP;
        }),
      }),
      transactionStatusRepository: {
        observeTransaction: jest.fn(),
        waitForTransaction: jest.fn(async ({ hash }: { hash: string }) => {
          order.push('settled');

          return outcome(hash, 'success');
        }),
      },
    });

    await collect(deps);

    expect(order[0]).toBe('settled');
    expect(order).toContain('build-swap');
    expect(order.indexOf('settled')).toBeLessThan(order.indexOf('build-swap'));
  });

  it('derives the approval grant from the same amount the check was made against', async () => {
    const checkApprovalRequired = jest.fn().mockResolvedValue(true);
    const buildApprovalTransaction = jest.fn().mockResolvedValue(BUILT_APPROVAL);
    const deps = makeDeps({
      dexContractRepository: stubDexContractRepository({
        checkApprovalRequired,
        buildApprovalTransaction,
        buildSwapTransaction: jest.fn().mockResolvedValue(BUILT_SWAP),
      }),
    });

    await collect(deps);

    const { requiredAmount } = checkApprovalRequired.mock.calls[0][0];
    const { amount } = buildApprovalTransaction.mock.calls[0][0];
    const expectedRequired = calculateMaxAmountWithSlippage('1000000000', 1);

    expect(requiredAmount).toBe(expectedRequired);
    expect(amount).toBe(calculateApprovalAmount(expectedRequired));
  });

  it('stops before the swap when the approval submission fails', async () => {
    const buildSwapTransaction = jest.fn().mockResolvedValue(BUILT_SWAP);
    const deps = makeDeps({
      dexContractRepository: stubDexContractRepository({
        checkApprovalRequired: jest.fn().mockResolvedValue(true),
        buildApprovalTransaction: jest.fn().mockResolvedValue(BUILT_APPROVAL),
        buildSwapTransaction,
      }),
      casperTransactionsRepository: {
        sendDexTransaction: jest.fn().mockRejectedValue(new Error('signing refused')),
      },
    });

    const { types, result } = await collect(deps);

    expect(types).toEqual(['approval:checking', 'approval:signing', 'failed']);
    expect(result.status).toBe('failed');
    expect(buildSwapTransaction).not.toHaveBeenCalled();
  });

  it('stops before the swap when the approval reverts on chain', async () => {
    const buildSwapTransaction = jest.fn().mockResolvedValue(BUILT_SWAP);
    const deps = makeDeps({
      dexContractRepository: stubDexContractRepository({
        checkApprovalRequired: jest.fn().mockResolvedValue(true),
        buildApprovalTransaction: jest.fn().mockResolvedValue(BUILT_APPROVAL),
        buildSwapTransaction,
      }),
      transactionStatusRepository: {
        observeTransaction: jest.fn(),
        waitForTransaction: jest.fn(async ({ hash }: { hash: string }) =>
          outcome(hash, 'failure', 'User error: 1'),
        ),
      },
    });

    const { events, result } = await collect(deps);
    const failed = events.find(e => e.type === 'failed');

    expect(failed).toMatchObject({ leg: 'approval' });
    expect(result.status).toBe('failed');
    expect(buildSwapTransaction).not.toHaveBeenCalled();
  });

  it('tells the settlement watch which artifact was submitted', async () => {
    const waitForTransaction = jest.fn(async ({ hash }: { hash: string }) =>
      outcome(hash, 'success'),
    );
    const transactionStatusRepository = { observeTransaction: jest.fn(), waitForTransaction };

    await collect(makeDeps({ transactionStatusRepository }));

    expect(waitForTransaction).toHaveBeenCalledWith(expect.objectContaining({ isDeploy: false }));

    waitForTransaction.mockClear();

    await collect(
      makeDeps({
        transactionStatusRepository,
        dexContractRepository: stubDexContractRepository({
          checkApprovalRequired: jest.fn().mockResolvedValue(false),
          buildSwapTransaction: jest.fn().mockResolvedValue(BUILT_SWAP_DEPLOY),
        }),
      }),
    );

    expect(waitForTransaction).toHaveBeenCalledWith(expect.objectContaining({ isDeploy: true }));
  });

  it('reports a reverted swap as a swap-leg failure carrying the node error', async () => {
    const deps = makeDeps({
      transactionStatusRepository: {
        observeTransaction: jest.fn(),
        waitForTransaction: jest.fn(async ({ hash }: { hash: string }) =>
          outcome(hash, 'failure', 'User error: 65534'),
        ),
      },
    });

    const { events, result } = await collect(deps);
    const failed = events.find(e => e.type === 'failed') as { leg: string; error: unknown };

    expect(failed.leg).toBe('swap');
    expect(String((failed.error as Error).message)).toContain('65534');
    expect(result.status).toBe('failed');
  });

  it('reports a settlement timeout as a failure, never as a confirmation', async () => {
    const deps = makeDeps({
      transactionStatusRepository: {
        observeTransaction: jest.fn(),
        waitForTransaction: jest.fn().mockRejectedValue(new TransactionTimeoutError('0xswap')),
      },
    });

    const { types, result } = await collect(deps);

    expect(types).not.toContain('swap:confirmed');
    expect(types).toContain('failed');
    expect(result.status).toBe('failed');
  });

  it('cancels before submitting anything when cancel lands during the approval check', async () => {
    let releaseCheck: () => void = () => undefined;
    const sendDexTransaction = jest.fn().mockResolvedValue('0xswap');
    const deps = makeDeps({
      dexContractRepository: stubDexContractRepository({
        checkApprovalRequired: jest.fn(
          () => new Promise<boolean>(resolve => (releaseCheck = () => resolve(true))),
        ),
        buildApprovalTransaction: jest.fn().mockResolvedValue(BUILT_APPROVAL),
        buildSwapTransaction: jest.fn().mockResolvedValue(BUILT_SWAP),
      }),
      casperTransactionsRepository: { sendDexTransaction },
    });

    const handle = createSwapFlowRunner(deps).start(startParams());
    const events = firstValueFrom(handle.events$.pipe(toArray()));

    handle.cancel();
    releaseCheck();

    expect((await events).map(e => e.type)).toContain('cancelled');
    expect(sendDexTransaction).not.toHaveBeenCalled();
    expect((await handle.done).status).toBe('cancelled');
  });

  it('keeps the submitted hash when cancelled while awaiting settlement', async () => {
    let releaseSettlement: () => void = () => undefined;
    const deps = makeDeps({
      transactionStatusRepository: {
        observeTransaction: jest.fn(),
        waitForTransaction: jest.fn(
          () =>
            new Promise(
              resolve => (releaseSettlement = () => resolve(outcome('0xswap', 'success'))),
            ),
        ),
      },
    });

    const handle = createSwapFlowRunner(deps).start(startParams());
    const events = firstValueFrom(handle.events$.pipe(toArray()));

    await new Promise(resolve => setTimeout(resolve, 10));
    handle.cancel();
    releaseSettlement();

    const result = await handle.done;

    expect((await events).map(e => e.type)).toContain('cancelled');
    expect(result.status).toBe('cancelled');
    expect(result.swapHash).toBe('0xswap');
  });

  it('hands the abort signal to the settlement watch and reports its abort as a cancellation', async () => {
    const waitForTransaction = jest.fn(
      ({ signal }: { signal?: AbortSignal }) =>
        new Promise<never>((_resolve, reject) =>
          signal?.addEventListener(
            'abort',
            () => reject(new TransactionWatchCancelledError('0xswap')),
            { once: true },
          ),
        ),
    );
    const deps = makeDeps({
      transactionStatusRepository: { observeTransaction: jest.fn(), waitForTransaction },
    });

    const handle = createSwapFlowRunner(deps).start(startParams());
    const events = firstValueFrom(handle.events$.pipe(toArray()));

    await new Promise(resolve => setTimeout(resolve, 10));
    handle.cancel();

    const result = await handle.done;
    const types = (await events).map(e => e.type);

    expect(waitForTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(types).toContain('cancelled');
    expect(types).not.toContain('failed');
    expect(result.status).toBe('cancelled');
  });

  it('keeps running after every subscriber has unsubscribed', async () => {
    const deps = makeDeps();
    const handle = createSwapFlowRunner(deps).start(startParams());

    const subscription = handle.events$.subscribe();
    subscription.unsubscribe();

    const result = await handle.done;

    expect(result.status).toBe('success');
    expect(deps.casperTransactionsRepository.sendDexTransaction).toHaveBeenCalledTimes(1);
  });

  it('replays the whole history to a subscriber that arrives after completion', async () => {
    const handle = createSwapFlowRunner(makeDeps()).start(startParams());

    await handle.done;

    const replayed = await firstValueFrom(handle.events$.pipe(toArray()));

    expect(replayed.map(e => e.type)).toEqual([
      'approval:checking',
      'approval:not-required',
      'swap:signing',
      'swap:sent',
      'swap:confirmed',
    ]);
  });

  it('serves two subscribers from one flow without duplicating any work', async () => {
    const deps = makeDeps();
    const handle = createSwapFlowRunner(deps).start(startParams());

    const [a, b] = await Promise.all([
      firstValueFrom(handle.events$.pipe(toArray())),
      firstValueFrom(handle.events$.pipe(toArray())),
    ]);

    expect(a.map(e => e.type)).toEqual(b.map(e => e.type));
    expect(deps.casperTransactionsRepository.sendDexTransaction).toHaveBeenCalledTimes(1);
  });

  it('returns the same handle from getActive while the flow is running', () => {
    const runner = createSwapFlowRunner(makeDeps());
    const handle = runner.start(startParams());

    expect(runner.getActive(handle.id)).toBe(handle);
  });

  it('forgets a finished flow', async () => {
    const runner = createSwapFlowRunner(makeDeps());
    const handle = runner.start(startParams());

    await handle.done;

    expect(runner.getActive(handle.id)).toBeNull();
  });

  it('completes at submission when settlement is not awaited', async () => {
    const deps = makeDeps();
    const { types, result } = await collect(deps, startParams({ awaitSettlement: false }));

    expect(types).toEqual([
      'approval:checking',
      'approval:not-required',
      'swap:signing',
      'swap:sent',
    ]);
    expect(result).toMatchObject({ status: 'success', swapHash: '0xswap' });
    expect(result.outcome).toBeUndefined();
  });

  it('merges ledger device events into the flow stream', async () => {
    const ledgerEvents$ = new Subject<ILedgerEvent>();
    const deps = makeDeps({ ledgerEvents$ });
    const handle = createSwapFlowRunner(deps).start(startParams());
    const events = firstValueFrom(handle.events$.pipe(toArray()));

    ledgerEvents$.next({ status: 'waiting-response' } as unknown as ILedgerEvent);

    expect((await events).some(e => e.type === 'ledger')).toBe(true);
  });

  it('completes normally when no ledger stream is supplied', async () => {
    const { types } = await collect(makeDeps());

    expect(types).not.toContain('ledger');
  });

  it('never rejects from done, whatever went wrong', async () => {
    const deps = makeDeps({
      casperTransactionsRepository: {
        sendDexTransaction: jest.fn().mockRejectedValue(new Error('boom')),
      },
    });

    const handle = createSwapFlowRunner(deps).start(startParams());

    await expect(handle.done).resolves.toMatchObject({ status: 'failed' });
  });

  it('reports an unclamped slippage as a failed approval leg, not a rejected done', async () => {
    const deps = makeDeps();
    const errored = jest.fn();
    const handle = createSwapFlowRunner(deps).start(startParams({ slippage: Number.NaN }));

    const events = await firstValueFrom(
      handle.events$.pipe(toArray()).pipe(tap({ error: errored })),
    );

    expect(events.map(e => e.type)).toEqual(['failed']);
    expect(errored).not.toHaveBeenCalled();
    await expect(handle.done).resolves.toMatchObject({ status: 'failed' });
    expect(deps.dexContractRepository.checkApprovalRequired).not.toHaveBeenCalled();
  });

  it('classifies an on-device rejection as cancelled without a supplied classifier', async () => {
    const deps = makeDeps({
      casperTransactionsRepository: {
        sendDexTransaction: jest
          .fn()
          .mockRejectedValue(new LedgerError({ status: LedgerEventStatus.SignatureCanceled })),
      },
    });

    const { types, result } = await collect(deps);

    expect(types).toContain('cancelled');
    expect(types).not.toContain('failed');
    expect(result.status).toBe('cancelled');
  });
});
