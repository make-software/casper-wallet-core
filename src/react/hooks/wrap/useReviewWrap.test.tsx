/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { Subject } from 'rxjs';

import { useReviewWrap } from './useReviewWrap';

import { TEST_PUBLIC_KEY } from '../../../__test-utils__/render-hook';
import type { WrapFlowEvent } from '../../../domain/flows';
import type { IDexTokenWithAmount } from '../../../domain/swap';

const token = (id: string): IDexTokenWithAmount =>
  ({ id, packageHash: id, decimals: 9, amountRaw: '1000000000', amountFormatted: '1' }) as never;

/** A runner whose single handle is driven by the test through `events$`. */
const makeRunner = () => {
  const events$ = new Subject<WrapFlowEvent>();
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
      useReviewWrap({
        network: 'testnet',
        activePublicKey: TEST_PUBLIC_KEY,
        wrapFlowRunner: runner as never,
        direction: 'wrap',
        sourceToken: token('cspr'),
        isOpen: props.isOpen,
        onWrapSuccess: jest.fn(),
        onClose: jest.fn(),
      }),
    { initialProps: { isOpen } },
  );

describe('useReviewWrap', () => {
  it('reaches the success step when the flow confirms the wrap', async () => {
    const runner = makeRunner();
    const { result } = setup(runner);

    await act(async () => {
      result.current.confirmWrap();
    });

    act(() => {
      runner.events$.next({ type: 'wrap:signing' });
      runner.events$.next({ type: 'wrap:sent', hash: '0xw' });
      runner.events$.next({
        type: 'wrap:confirmed',
        outcome: { hash: '0xw', status: 'success', blockHeight: 1 },
      });
    });

    await waitFor(() => expect(result.current.step).toBe('success'));
    expect(result.current.status).toBe('success');
    expect(result.current.transactionHash).toBe('0xw');
  });

  it('surfaces a failure and returns to the confirm step', async () => {
    const runner = makeRunner();
    const { result } = setup(runner);

    await act(async () => {
      result.current.confirmWrap();
    });

    act(() => {
      runner.events$.next({ type: 'wrap:signing' });
      runner.events$.next({ type: 'failed', error: new Error('nope') });
    });

    await waitFor(() => expect(result.current.step).toBe('confirm'));
    expect(result.current.error).toBe('nope');
    expect(result.current.isProcessing).toBe(false);
  });

  it('never starts a second flow while one is already running', async () => {
    const runner = makeRunner();
    const { result } = setup(runner);

    await act(async () => {
      result.current.confirmWrap();
      result.current.confirmWrap();
    });

    expect(runner.start).toHaveBeenCalledTimes(1);
  });

  it('does not cancel the flow when the modal closes', async () => {
    const runner = makeRunner();
    const { result, rerender } = setup(runner);

    await act(async () => {
      result.current.confirmWrap();
    });

    rerender({ isOpen: false });

    expect(runner.cancel).not.toHaveBeenCalled();
  });

  it('calls onWrapSuccess exactly once when the wrap confirms', async () => {
    const runner = makeRunner();
    const onWrapSuccess = jest.fn();

    const { result } = renderHook(() =>
      useReviewWrap({
        network: 'testnet',
        activePublicKey: TEST_PUBLIC_KEY,
        wrapFlowRunner: runner as never,
        direction: 'wrap',
        sourceToken: token('cspr'),
        isOpen: true,
        onWrapSuccess,
        onClose: jest.fn(),
      }),
    );

    await act(async () => {
      result.current.confirmWrap();
    });

    act(() => {
      runner.events$.next({
        type: 'wrap:confirmed',
        outcome: { hash: '0xw', status: 'success', blockHeight: 1 },
      });
      runner.events$.next({
        type: 'wrap:confirmed',
        outcome: { hash: '0xw', status: 'success', blockHeight: 1 },
      });
    });

    await waitFor(() => expect(onWrapSuccess).toHaveBeenCalledTimes(1));
  });
});
