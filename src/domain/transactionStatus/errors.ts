import { isDomainError, isError, IDomainError } from '../common';

export type TransactionStatusErrorType = 'timeout' | 'lookup' | 'cancelled';

export type ITransactionStatusError = IDomainError<TransactionStatusErrorType>;

export class TransactionStatusError extends Error implements ITransactionStatusError {
  constructor(error: Error | unknown, type: TransactionStatusErrorType) {
    if (isError(error)) {
      super(error.message);
      this.stack = error.stack;
      this.traceable = isDomainError(error) ? Boolean(error.traceable) : true;
    } else {
      super(JSON.stringify(error));
      this.traceable = true;
    }

    this.name = 'TransactionStatusError';
    this.type = type;
  }

  type: TransactionStatusErrorType;
  traceable: boolean;
}

export function isTransactionStatusError(
  error: unknown | ITransactionStatusError,
): error is ITransactionStatusError {
  return error instanceof TransactionStatusError && error.name === 'TransactionStatusError';
}

/**
 * Polling gave up before the transaction executed. Deliberately not a `'failure'` outcome: the
 * transaction may still settle, and a caller must be able to tell the two apart.
 */
export class TransactionTimeoutError extends TransactionStatusError {
  readonly hash: string;

  constructor(hash: string) {
    super(new Error('errors:transaction-settlement-timeout'), 'timeout');
    this.hash = hash;
  }
}

export function isTransactionTimeoutError(error: unknown): error is TransactionTimeoutError {
  return error instanceof TransactionTimeoutError;
}

/**
 * The caller aborted the watch. Like a timeout it says nothing about the transaction, which is
 * very likely still on its way to a block.
 */
export class TransactionWatchCancelledError extends TransactionStatusError {
  readonly hash: string;

  constructor(hash: string) {
    super(new Error('errors:transaction-watch-cancelled'), 'cancelled');
    this.hash = hash;
  }
}

export function isTransactionWatchCancelledError(
  error: unknown,
): error is TransactionWatchCancelledError {
  return error instanceof TransactionWatchCancelledError;
}
