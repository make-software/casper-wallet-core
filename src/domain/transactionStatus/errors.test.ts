import {
  isTransactionStatusError,
  isTransactionTimeoutError,
  isTransactionWatchCancelledError,
  TransactionStatusError,
  TransactionTimeoutError,
  TransactionWatchCancelledError,
} from './errors';

describe('TransactionStatusError', () => {
  it('keeps name, type, message, stack, traceable and the source error', () => {
    const inner = new Error('lookup exploded');
    const err = new TransactionStatusError(inner, 'lookup');

    expect(err.name).toBe('TransactionStatusError');
    expect(err.type).toBe('lookup');
    expect(err.message).toBe('lookup exploded');
    expect(err.stack).toBe(inner.stack);
    expect(err.traceable).toBe(true);
    expect(err.sourceError).toBe(inner);
    expect(isTransactionStatusError(err)).toBe(true);
  });

  it('keeps the fixed-message subclasses intact', () => {
    const timeout = new TransactionTimeoutError('aabb');
    expect(timeout.message).toBe('errors:transaction-settlement-timeout');
    expect(timeout.type).toBe('timeout');
    expect(timeout.hash).toBe('aabb');
    expect(isTransactionTimeoutError(timeout)).toBe(true);

    const cancelled = new TransactionWatchCancelledError('ccdd');
    expect(cancelled.message).toBe('errors:transaction-watch-cancelled');
    expect(cancelled.type).toBe('cancelled');
    expect(cancelled.hash).toBe('ccdd');
    expect(isTransactionWatchCancelledError(cancelled)).toBe(true);
  });
});
