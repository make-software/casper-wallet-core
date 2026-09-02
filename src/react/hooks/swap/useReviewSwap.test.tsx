/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { ReplaySubject } from 'rxjs';

import { useReviewSwap } from './useReviewSwap';

import { TEST_PUBLIC_KEY } from '../../../__test-utils__/render-hook';
import type { ILedgerEvent } from '../../../domain/ledger';
import { SwapQuoteType } from '../../../domain/swap';
import type { ISwapFlowHandle, ISwapFlowResult, SwapFlowEvent } from '../../../domain/flows';
import type { IDexTokenWithAmount } from '../../../domain/swap';

const token = (id: string): IDexTokenWithAmount =>
  ({ id, packageHash: id, decimals: 9, amountRaw: '1000000000', amountFormatted: '1' }) as never;

/** Test double for a flow runner; `events$` replays like the real one. */
const makeRunner = (publicKey = TEST_PUBLIC_KEY) => {
  const cancel = jest.fn();
  const flows: Array<{
    events$: ReplaySubject<SwapFlowEvent>;
    settle: (result: ISwapFlowResult) => void;
    handle: ISwapFlowHandle;
  }> = [];

  const start = jest.fn((): ISwapFlowHandle => {
    const events$ = new ReplaySubject<SwapFlowEvent>(Infinity);
    let settle!: (result: ISwapFlowResult) => void;
    const done = new Promise<ISwapFlowResult>(resolve => {
      settle = resolve;
    });
    const handle: ISwapFlowHandle = {
      id: `flow-${flows.length + 1}`,
      events$: events$.asObservable(),
      done,
      cancel,
    };

    flows.push({ events$, settle, handle });

    return handle;
  });

  const current = () => flows[flows.length - 1];

  return {
    cancel,
    start,
    publicKey,
    getActive: jest.fn(() => current()?.handle ?? null),
    get events$() {
      return current().events$;
    },
    settle: (result: ISwapFlowResult = { status: 'success' }) => current().settle(result),
  };
};

const setup = (runner: ReturnType<typeof makeRunner>, isOpen = true) =>
  renderHook(
    (props: { isOpen: boolean }) =>
      useReviewSwap({
        network: 'testnet',
        activePublicKey: TEST_PUBLIC_KEY,
        swapFlowRunner: runner as never,
        slippage: 1,
        deadline: 20,
        trade: {
          firstToken: token('in'),
          secondToken: token('out'),
          path: ['in', 'out'],
          quoteType: SwapQuoteType.ExactIn,
        },
        isOpen: props.isOpen,
        onSwapSuccess: jest.fn(),
        onClose: jest.fn(),
      }),
    { initialProps: { isOpen } },
  );

describe('useReviewSwap', () => {
  it('reaches the success step when the flow confirms the swap', async () => {
    const runner = makeRunner();
    const { result } = setup(runner);

    await act(async () => {
      result.current.confirmSwap();
    });

    act(() => {
      runner.events$.next({ type: 'approval:checking' });
      runner.events$.next({ type: 'approval:not-required' });
      runner.events$.next({ type: 'swap:signing' });
      runner.events$.next({ type: 'swap:sent', hash: '0xb' });
      runner.events$.next({
        type: 'swap:confirmed',
        outcome: { hash: '0xb', status: 'success', blockHeight: 1 },
      });
    });

    await waitFor(() => expect(result.current.step).toBe('success'));
    expect(result.current.transactionState.swap.status).toBe('success');
    expect(result.current.transactionHash).toBe('0xb');
  });

  it('exposes the approval leg once it has been submitted and settled', async () => {
    const runner = makeRunner();
    const { result } = setup(runner);

    await act(async () => {
      result.current.confirmSwap();
    });

    act(() => {
      runner.events$.next({ type: 'approval:checking' });
      runner.events$.next({ type: 'approval:signing' });
      runner.events$.next({ type: 'approval:sent', hash: '0xa' });
      runner.events$.next({ type: 'approval:confirmed' });
    });

    await waitFor(() => expect(result.current.transactionState.approval.status).toBe('success'));
    expect(result.current.transactionState.approval.isRequired).toBe(true);
    expect(result.current.transactionState.approval.transactionHash).toBe('0xa');
  });

  it('scopes a swap failure to the swap leg', async () => {
    const runner = makeRunner();
    const { result } = setup(runner);

    await act(async () => {
      result.current.confirmSwap();
    });

    act(() => {
      runner.events$.next({ type: 'approval:checking' });
      runner.events$.next({ type: 'approval:signing' });
      runner.events$.next({ type: 'approval:sent', hash: '0xa' });
      runner.events$.next({ type: 'approval:confirmed' });
      runner.events$.next({ type: 'failed', leg: 'swap', error: new Error('slippage') });
    });

    await waitFor(() => expect(result.current.transactionState.swap.error).toBe('slippage'));
    expect(result.current.transactionState.approval.status).toBe('success');
  });

  it('returns to a retryable confirm step after a failure, and actually retries', async () => {
    const runner = makeRunner();
    const { result } = setup(runner);

    await act(async () => {
      result.current.confirmSwap();
    });

    act(() => {
      runner.events$.next({ type: 'approval:checking' });
      runner.events$.next({ type: 'failed', leg: 'approval', error: new Error('nope') });
    });

    await waitFor(() => expect(result.current.step).toBe('confirm'));
    expect(result.current.isProcessing).toBe(false);

    await act(async () => {
      runner.settle({ status: 'failed', error: new Error('nope') });
    });

    await act(async () => {
      result.current.confirmSwap();
    });

    expect(runner.start).toHaveBeenCalledTimes(2);
  });

  it('refuses a second start while the first flow is still unsettled', async () => {
    const runner = makeRunner();
    const { result } = setup(runner);

    await act(async () => {
      result.current.confirmSwap();
    });

    act(() => {
      runner.events$.next({ type: 'failed', leg: 'swap', error: new Error('nope') });
    });

    await waitFor(() => expect(result.current.step).toBe('confirm'));

    await act(async () => {
      result.current.resetForm();
      result.current.confirmSwap();
    });

    expect(runner.start).toHaveBeenCalledTimes(1);
    expect(result.current.transactionState.swap.error).toBe('nope');
  });

  it('refuses to start against a runner bound to a different account', async () => {
    const runner = makeRunner('other-account');
    const { result } = setup(runner);

    await act(async () => {
      result.current.confirmSwap();
    });

    expect(runner.start).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(result.current.transactionState.swap.error).toContain('runner-account-mismatch'),
    );
  });

  it('does not start without a quoted trade', async () => {
    const runner = makeRunner();
    const { result } = renderHook(() =>
      useReviewSwap({
        network: 'testnet',
        activePublicKey: TEST_PUBLIC_KEY,
        swapFlowRunner: runner as never,
        slippage: 1,
        deadline: 20,
        trade: null,
        isOpen: true,
        onSwapSuccess: jest.fn(),
        onClose: jest.fn(),
      }),
    );

    await act(async () => {
      result.current.confirmSwap();
    });

    expect(runner.start).not.toHaveBeenCalled();
  });

  it('replays progress the surface missed while it was closed', async () => {
    const runner = makeRunner();
    const onSwapSuccess = jest.fn();
    const { result, rerender } = renderHook(
      (props: { isOpen: boolean }) =>
        useReviewSwap({
          network: 'testnet',
          activePublicKey: TEST_PUBLIC_KEY,
          swapFlowRunner: runner as never,
          slippage: 1,
          deadline: 20,
          trade: {
            firstToken: token('in'),
            secondToken: token('out'),
            path: ['in', 'out'],
            quoteType: SwapQuoteType.ExactIn,
          },
          isOpen: props.isOpen,
          onSwapSuccess,
          onClose: jest.fn(),
        }),
      { initialProps: { isOpen: true } },
    );

    await act(async () => {
      result.current.confirmSwap();
    });

    rerender({ isOpen: false });

    act(() => {
      runner.events$.next({ type: 'swap:sent', hash: '0xb' });
      runner.events$.next({
        type: 'swap:confirmed',
        outcome: { hash: '0xb', status: 'success', blockHeight: 1 },
      });
    });

    expect(onSwapSuccess).not.toHaveBeenCalled();

    rerender({ isOpen: true });

    await waitFor(() => expect(result.current.step).toBe('success'));
    expect(onSwapSuccess).toHaveBeenCalledTimes(1);
  });

  it('never starts a second flow while one is already running', async () => {
    const runner = makeRunner();
    const { result } = setup(runner);

    await act(async () => {
      result.current.confirmSwap();
      result.current.confirmSwap();
    });

    expect(runner.start).toHaveBeenCalledTimes(1);
  });

  it('does not cancel the flow when the modal closes', async () => {
    const runner = makeRunner();
    const { result, rerender } = setup(runner);

    await act(async () => {
      result.current.confirmSwap();
    });

    act(() => {
      runner.events$.next({ type: 'swap:signing' });
      runner.events$.next({ type: 'swap:sent', hash: '0xb' });
    });

    rerender({ isOpen: false });

    expect(runner.cancel).not.toHaveBeenCalled();
  });

  it('shows the flow’s real progress when the modal is reopened mid-flow', async () => {
    const runner = makeRunner();
    const { result, rerender } = setup(runner);

    await act(async () => {
      result.current.confirmSwap();
    });

    act(() => {
      runner.events$.next({ type: 'swap:signing' });
      runner.events$.next({ type: 'swap:sent', hash: '0xb' });
    });

    rerender({ isOpen: false });
    rerender({ isOpen: true });

    await waitFor(() => expect(result.current.transactionState.swap.status).toBe('awaiting'));
    expect(result.current.transactionHash).toBe('0xb');
  });

  it('does not cancel the flow on unmount', async () => {
    const runner = makeRunner();
    const { result, unmount } = setup(runner);

    await act(async () => {
      result.current.confirmSwap();
    });

    unmount();

    expect(runner.cancel).not.toHaveBeenCalled();
  });

  it('calls onSwapSuccess exactly once when the swap confirms', async () => {
    const runner = makeRunner();
    const onSwapSuccess = jest.fn();

    const { result } = renderHook(() =>
      useReviewSwap({
        network: 'testnet',
        activePublicKey: TEST_PUBLIC_KEY,
        swapFlowRunner: runner as never,
        slippage: 1,
        deadline: 20,
        trade: {
          firstToken: token('in'),
          secondToken: token('out'),
          path: ['in', 'out'],
          quoteType: SwapQuoteType.ExactIn,
        },
        isOpen: true,
        onSwapSuccess,
        onClose: jest.fn(),
      }),
    );

    await act(async () => {
      result.current.confirmSwap();
    });

    act(() => {
      runner.events$.next({
        type: 'swap:confirmed',
        outcome: { hash: '0xb', status: 'success', blockHeight: 1 },
      });
      runner.events$.next({
        type: 'swap:confirmed',
        outcome: { hash: '0xb', status: 'success', blockHeight: 1 },
      });
    });

    await waitFor(() => expect(onSwapSuccess).toHaveBeenCalledTimes(1));
  });

  it('stops applying events once the modal is closed', async () => {
    const runner = makeRunner();
    const { result, rerender } = setup(runner);

    await act(async () => {
      result.current.confirmSwap();
    });

    act(() => {
      runner.events$.next({ type: 'swap:signing' });
      runner.events$.next({ type: 'swap:sent', hash: '0xb' });
    });

    rerender({ isOpen: false });

    act(() => {
      runner.events$.next({
        type: 'swap:confirmed',
        outcome: { hash: '0xb', status: 'success', blockHeight: 1 },
      });
    });

    expect(result.current.step).toBe('signing');
    expect(result.current.transactionState.swap.status).toBe('awaiting');
  });

  it('surfaces a ledger event without disturbing leg statuses', async () => {
    const runner = makeRunner();
    const { result } = setup(runner);
    const ledgerEvent = { status: 'waiting-response' } as unknown as ILedgerEvent;

    await act(async () => {
      result.current.confirmSwap();
    });

    act(() => {
      runner.events$.next({ type: 'swap:signing' });
      runner.events$.next({ type: 'ledger', event: ledgerEvent });
    });

    await waitFor(() => expect(result.current.ledgerEvent).toBe(ledgerEvent));
    expect(result.current.transactionState.swap.status).toBe('pending');
  });
});
