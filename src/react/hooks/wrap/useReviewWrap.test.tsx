/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { ReplaySubject } from 'rxjs';

import { useReviewWrap } from './useReviewWrap';

import { TEST_PUBLIC_KEY } from '../../../__test-utils__/render-hook';
import type { IWrapFlowHandle, IWrapFlowResult, WrapFlowEvent } from '../../../domain/flows';
import type { IDexTokenWithAmount } from '../../../domain/swap';

const token = (id: string): IDexTokenWithAmount =>
  ({ id, packageHash: id, decimals: 9, amountRaw: '1000000000', amountFormatted: '1' }) as never;

/**
 * A runner whose handles the test drives. `events$` is a `ReplaySubject` like the real one, so an
 * event emitted while the surface is closed is still there when it resubscribes, and `settle`
 * resolves `done` — which is what releases the hook's re-entrancy guard.
 */
const makeRunner = (publicKey = TEST_PUBLIC_KEY) => {
  const cancel = jest.fn();
  const flows: Array<{
    events$: ReplaySubject<WrapFlowEvent>;
    settle: (result: IWrapFlowResult) => void;
    handle: IWrapFlowHandle;
  }> = [];

  const start = jest.fn((): IWrapFlowHandle => {
    const events$ = new ReplaySubject<WrapFlowEvent>(Infinity);
    let settle!: (result: IWrapFlowResult) => void;
    const done = new Promise<IWrapFlowResult>(resolve => {
      settle = resolve;
    });
    const handle: IWrapFlowHandle = {
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
    settle: (result: IWrapFlowResult = { status: 'success' }) => current().settle(result),
  };
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

  it('retries in place after a failure once the flow has settled', async () => {
    const runner = makeRunner();
    const { result } = setup(runner);

    await act(async () => {
      result.current.confirmWrap();
    });

    act(() => {
      runner.events$.next({ type: 'failed', error: new Error('nope') });
    });

    await waitFor(() => expect(result.current.step).toBe('confirm'));

    await act(async () => {
      runner.settle({ status: 'failed', error: new Error('nope') });
    });

    await act(async () => {
      result.current.confirmWrap();
    });

    expect(runner.start).toHaveBeenCalledTimes(2);
  });

  it('retries after a success once the flow has settled', async () => {
    const runner = makeRunner();
    const { result } = setup(runner);

    await act(async () => {
      result.current.confirmWrap();
    });

    act(() => {
      runner.events$.next({
        type: 'wrap:confirmed',
        outcome: { hash: '0xw', status: 'success', blockHeight: 1 },
      });
    });

    await waitFor(() => expect(result.current.step).toBe('success'));

    await act(async () => {
      runner.settle();
    });

    await act(async () => {
      result.current.confirmWrap();
    });

    expect(runner.start).toHaveBeenCalledTimes(2);
  });

  it('refuses to start against a runner bound to a different account', async () => {
    const runner = makeRunner('other-account');
    const { result } = setup(runner);

    await act(async () => {
      result.current.confirmWrap();
    });

    expect(runner.start).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.error).toContain('runner-account-mismatch'));
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
