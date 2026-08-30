/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { Subject } from 'rxjs';

import { useReviewSwap } from './useReviewSwap';

import { TEST_PUBLIC_KEY } from '../../../__test-utils__/render-hook';
import type { ILedgerEvent } from '../../../domain/ledger';
import { SwapQuoteType } from '../../../domain/swap';
import type { SwapFlowEvent } from '../../../domain/flows';
import type { IDexTokenWithAmount } from '../../../domain/swap';

const token = (id: string): IDexTokenWithAmount =>
  ({ id, packageHash: id, decimals: 9, amountRaw: '1000000000', amountFormatted: '1' }) as never;

/** A runner whose single handle is driven by the test through `events$`. */
const makeRunner = () => {
  const events$ = new Subject<SwapFlowEvent>();
  const cancel = jest.fn();
  const handle = {
    id: 'flow-1',
    events$: events$.asObservable(),
    done: new Promise(() => {}),
    cancel,
  };
  const start = jest.fn(() => handle);

  return { events$, cancel, start, handle, getActive: jest.fn(() => handle) };
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
        firstToken: token('in'),
        secondToken: token('out'),
        path: ['in', 'out'],
        quoteType: SwapQuoteType.ExactIn,
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

  it('returns to a retryable confirm step after a failure', async () => {
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
        firstToken: token('in'),
        secondToken: token('out'),
        path: ['in', 'out'],
        quoteType: SwapQuoteType.ExactIn,
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
