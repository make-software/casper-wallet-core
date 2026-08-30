import { Subject, firstValueFrom, toArray } from 'rxjs';

import { createWrapFlowRunner } from './wrapFlow';

import { stubDexContractRepository, TEST_PUBLIC_KEY } from '../../__test-utils__/render-hook';
import { TransactionTimeoutError } from '../../domain/transactionStatus';
import type { ILedgerEvent } from '../../domain/ledger';
import type { IStartWrapFlowParams } from '../../domain/flows';
import type { IWrapFlowDeps } from './wrapFlow';

const BUILT_WRAP = { kind: 'wrap', transaction: {} } as never;
const BUILT_UNWRAP = { kind: 'unwrap', transaction: {} } as never;

const outcome = (hash: string, status: 'success' | 'failure', errorMessage?: string) => ({
  hash,
  status,
  blockHeight: 1,
  ...(errorMessage ? { errorMessage } : {}),
});

const makeDeps = (over: Partial<IWrapFlowDeps> = {}): IWrapFlowDeps => ({
  network: 'testnet',
  publicKey: TEST_PUBLIC_KEY,
  signer: { publicKeyHex: TEST_PUBLIC_KEY } as never,
  supportsTransactionV1: true,
  dexContractRepository: stubDexContractRepository({
    buildWrapTransaction: jest.fn().mockResolvedValue(BUILT_WRAP),
    buildUnwrapTransaction: jest.fn().mockResolvedValue(BUILT_UNWRAP),
  }),
  casperTransactionsRepository: {
    sendDexTransaction: jest.fn().mockResolvedValue('0xwrap'),
  },
  transactionStatusRepository: {
    observeTransaction: jest.fn(),
    waitForTransaction: jest.fn(async ({ hash }: { hash: string }) => outcome(hash, 'success')),
  },
  ...over,
});

const startParams = (over: Partial<IStartWrapFlowParams> = {}): IStartWrapFlowParams => ({
  direction: 'wrap',
  rawAmount: '1000000000',
  ...over,
});

const collect = async (deps: IWrapFlowDeps, params = startParams()) => {
  const handle = createWrapFlowRunner(deps).start(params);
  const events = await firstValueFrom(handle.events$.pipe(toArray()));

  return { handle, events, types: events.map(e => e.type), result: await handle.done };
};

describe('createWrapFlowRunner', () => {
  it('builds a wrap from the motes amount', async () => {
    const deps = makeDeps();
    await collect(deps, { direction: 'wrap', rawAmount: '1000000000' });

    expect(deps.dexContractRepository.buildWrapTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ motesAmount: '1000000000', useTransactionV1: true }),
    );
    expect(deps.dexContractRepository.buildUnwrapTransaction).not.toHaveBeenCalled();
  });

  it('builds an unwrap from the raw amount', async () => {
    const deps = makeDeps();
    await collect(deps, { direction: 'unwrap', rawAmount: '1000000000' });

    expect(deps.dexContractRepository.buildUnwrapTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ rawAmount: '1000000000', useTransactionV1: true }),
    );
    expect(deps.dexContractRepository.buildWrapTransaction).not.toHaveBeenCalled();
  });

  it('emits signing, sent and confirmed for a settled wrap', async () => {
    const { types } = await collect(makeDeps(), { direction: 'wrap', rawAmount: '1' });

    expect(types).toEqual(['wrap:signing', 'wrap:sent', 'wrap:confirmed']);
  });

  it('emits failed and resolves done as failed when submission fails', async () => {
    const deps = makeDeps({
      casperTransactionsRepository: {
        sendDexTransaction: jest.fn().mockRejectedValue(new Error('signing refused')),
      },
    });

    const { types, result } = await collect(deps, { direction: 'wrap', rawAmount: '1' });

    expect(types).toEqual(['wrap:signing', 'failed']);
    expect(result.status).toBe('failed');
  });

  it('reports a revert as a failure and never as a confirmation', async () => {
    const deps = makeDeps({
      transactionStatusRepository: {
        observeTransaction: jest.fn(),
        waitForTransaction: jest.fn(async ({ hash }: { hash: string }) => ({
          hash,
          status: 'failure' as const,
          blockHeight: 1,
          errorMessage: 'User error: 3',
        })),
      },
    });

    const { types, result } = await collect(deps, { direction: 'wrap', rawAmount: '1' });

    expect(types).not.toContain('wrap:confirmed');
    expect(types).toContain('failed');
    expect(result.status).toBe('failed');
  });

  it('reports a settlement timeout as a failure, never as a confirmation', async () => {
    const deps = makeDeps({
      transactionStatusRepository: {
        observeTransaction: jest.fn(),
        waitForTransaction: jest.fn().mockRejectedValue(new TransactionTimeoutError('0xwrap')),
      },
    });

    const { types, result } = await collect(deps, { direction: 'wrap', rawAmount: '1' });

    expect(types).not.toContain('wrap:confirmed');
    expect(types).toContain('failed');
    expect(result.status).toBe('failed');
  });

  it('cancels before submitting anything when cancel lands before the build resolves', async () => {
    let releaseBuild: () => void = () => undefined;
    const sendDexTransaction = jest.fn().mockResolvedValue('0xwrap');
    const deps = makeDeps({
      dexContractRepository: stubDexContractRepository({
        buildWrapTransaction: jest.fn(
          () => new Promise(resolve => (releaseBuild = () => resolve(BUILT_WRAP))),
        ),
        buildUnwrapTransaction: jest.fn().mockResolvedValue(BUILT_UNWRAP),
      }),
      casperTransactionsRepository: { sendDexTransaction },
    });

    const handle = createWrapFlowRunner(deps).start(startParams());
    const events = firstValueFrom(handle.events$.pipe(toArray()));

    await new Promise(resolve => setTimeout(resolve, 10));
    handle.cancel();
    releaseBuild();

    expect((await events).map(e => e.type)).toContain('cancelled');
    expect(sendDexTransaction).not.toHaveBeenCalled();
    expect((await handle.done).status).toBe('cancelled');
  });

  it('keeps running after every subscriber has unsubscribed', async () => {
    const deps = makeDeps();
    const handle = createWrapFlowRunner(deps).start({ direction: 'wrap', rawAmount: '1' });

    handle.events$.subscribe().unsubscribe();

    await expect(handle.done).resolves.toMatchObject({ status: 'success' });
  });

  it('completes at submission when settlement is not awaited', async () => {
    const { types, result } = await collect(makeDeps(), {
      direction: 'wrap',
      rawAmount: '1',
      awaitSettlement: false,
    });

    expect(types).toEqual(['wrap:signing', 'wrap:sent']);
    expect(result).toMatchObject({ status: 'success', wrapHash: '0xwrap' });
    expect(result.outcome).toBeUndefined();
  });

  it('merges ledger device events into the flow stream', async () => {
    const ledgerEvents$ = new Subject<ILedgerEvent>();
    const deps = makeDeps({ ledgerEvents$ });
    const handle = createWrapFlowRunner(deps).start(startParams());
    const events = firstValueFrom(handle.events$.pipe(toArray()));

    ledgerEvents$.next({ status: 'waiting-response' } as unknown as ILedgerEvent);

    expect((await events).some(e => e.type === 'ledger')).toBe(true);
  });
});
