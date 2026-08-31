import { initialSwapFlowState, swapFlowReducer } from './swapReducer';

import type { ISwapFlowResult, IWrapFlowResult, SwapFlowEvent } from './entities';
import type { ILedgerEvent } from '../ledger';

const reduceAll = (events: SwapFlowEvent[]) => events.reduce(swapFlowReducer, initialSwapFlowState);

describe('swapFlowReducer', () => {
  it('starts on the confirm step with both legs idle', () => {
    expect(initialSwapFlowState).toEqual({
      step: 'confirm',
      approval: { isRequired: false, status: 'idle' },
      swap: { status: 'idle' },
    });
  });

  it('moves to the signing step while the approval requirement is being checked', () => {
    const state = reduceAll([{ type: 'approval:checking' }]);

    expect(state.step).toBe('signing');
    expect(state.approval.status).toBe('pending');
  });

  it('marks the approval leg done when no approval is required', () => {
    const state = reduceAll([{ type: 'approval:checking' }, { type: 'approval:not-required' }]);

    expect(state.approval).toEqual({ isRequired: false, status: 'success' });
  });

  it('records the approval hash and awaits settlement once submitted', () => {
    const state = reduceAll([
      { type: 'approval:checking' },
      { type: 'approval:signing' },
      { type: 'approval:sent', hash: '0xa' },
    ]);

    expect(state.approval.hash).toBe('0xa');
    expect(state.approval.status).toBe('awaiting');
    expect(state.approval.isRequired).toBe(true);
  });

  it('marks the approval successful once it settles', () => {
    const state = reduceAll([
      { type: 'approval:checking' },
      { type: 'approval:signing' },
      { type: 'approval:sent', hash: '0xa' },
      { type: 'approval:confirmed' },
    ]);

    expect(state.approval.status).toBe('success');
  });

  it('records the swap hash and awaits settlement once submitted', () => {
    const state = reduceAll([{ type: 'swap:signing' }, { type: 'swap:sent', hash: '0xb' }]);

    expect(state.swap).toEqual({ status: 'awaiting', hash: '0xb' });
  });

  it('reaches the success step once the swap settles', () => {
    const state = reduceAll([
      { type: 'swap:signing' },
      { type: 'swap:sent', hash: '0xb' },
      {
        type: 'swap:confirmed',
        outcome: { hash: '0xb', status: 'success', blockHeight: 1 },
      },
    ]);

    expect(state.step).toBe('success');
    expect(state.swap.status).toBe('success');
  });

  it('scopes a swap failure to the swap leg, leaving a successful approval intact', () => {
    const state = reduceAll([
      { type: 'approval:checking' },
      { type: 'approval:signing' },
      { type: 'approval:sent', hash: '0xa' },
      { type: 'approval:confirmed' },
      { type: 'failed', leg: 'swap', error: new Error('slippage exceeded') },
    ]);

    expect(state.approval.status).toBe('success');
    expect(state.approval.error).toBeUndefined();
    expect(state.swap.status).toBe('error');
    expect(state.swap.error).toBe('slippage exceeded');
  });

  it('returns to the confirm step on failure so the surface is retryable in place', () => {
    const state = reduceAll([
      { type: 'approval:checking' },
      { type: 'failed', leg: 'approval', error: new Error('nope') },
    ]);

    expect(state.step).toBe('confirm');
  });

  it('treats cancellation as idle rather than as an error', () => {
    const state = reduceAll([{ type: 'swap:signing' }, { type: 'cancelled', leg: 'swap' }]);

    expect(state.swap.status).toBe('idle');
    expect(state.swap.error).toBeUndefined();
    expect(state.step).toBe('confirm');
  });

  it('records a ledger event without disturbing leg state', () => {
    const ledgerEvent = { status: 'waiting-response' } as unknown as ILedgerEvent;

    const state = reduceAll([
      { type: 'swap:signing' },
      { type: 'swap:sent', hash: '0xb' },
      { type: 'ledger', event: ledgerEvent },
    ]);

    expect(state.ledgerEvent).toBe(ledgerEvent);
    expect(state.swap.status).toBe('awaiting');
  });

  it('is pure — it neither mutates its input nor varies between identical applications', () => {
    const before = reduceAll([{ type: 'approval:checking' }]);
    const snapshot = JSON.parse(JSON.stringify(before));

    const first = swapFlowReducer(before, { type: 'approval:not-required' });
    const second = swapFlowReducer(before, { type: 'approval:not-required' });

    expect(before).toEqual(snapshot);
    expect(first).toEqual(second);
    expect(first).not.toBe(before);
  });

  it('walks the full no-approval happy path to success', () => {
    const state = reduceAll([
      { type: 'approval:checking' },
      { type: 'approval:not-required' },
      { type: 'swap:signing' },
      { type: 'swap:sent', hash: '0xb' },
      {
        type: 'swap:confirmed',
        outcome: { hash: '0xb', status: 'success', blockHeight: 3 },
      },
    ]);

    expect(state).toEqual({
      step: 'success',
      approval: { isRequired: false, status: 'success' },
      swap: { status: 'success', hash: '0xb' },
    });
  });
});

/**
 * Compile-time only. `tsc` runs over the test tree in `yarn code:check`, so a `@ts-expect-error`
 * that stops erroring fails the build — which is what makes these assertions, not comments.
 */
describe('flow type contracts', () => {
  it('rejects the states the unions exist to forbid', () => {
    // A confirmed swap cannot carry a reverted outcome.
    const reverted: SwapFlowEvent = {
      type: 'swap:confirmed',
      // @ts-expect-error 'failure' is not assignable to 'success'
      outcome: { hash: '0xb', status: 'failure', blockHeight: 3, errorMessage: 'User error: 1' },
    };

    // A failed flow must carry its error.
    // @ts-expect-error 'error' is required on the failed arm
    const failedWithoutError: ISwapFlowResult = { status: 'failed' };

    // A successful flow cannot carry one.
    // @ts-expect-error 'error' does not exist on the success arm
    const successWithError: IWrapFlowResult = { status: 'success', error: new Error('boom') };

    expect([reverted, failedWithoutError, successWithError]).toHaveLength(3);
  });
});
