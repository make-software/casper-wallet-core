import { isDomainError, isError, IDomainError } from '../common';
import type { ICasperTransactionsRepository } from './repository';

export type CasperTransactionsErrorType = keyof ICasperTransactionsRepository | 'signature';

export type ICasperTransactionsError = IDomainError<CasperTransactionsErrorType>;

export class CasperTransactionsError extends Error implements ICasperTransactionsError {
  constructor(error: Error | unknown, type: CasperTransactionsErrorType) {
    if (isError(error)) {
      super(error.message);
      this.stack = error.stack;
      this.traceable = isDomainError(error) ? Boolean(error.traceable) : true;
    } else {
      super(JSON.stringify(error));
      this.traceable = true;
    }

    this.name = 'CasperTransactionsError';
    this.type = type;
  }

  type: CasperTransactionsErrorType;
  traceable: boolean;
}

export function isCasperTransactionsError(
  error: unknown | ICasperTransactionsError,
): error is ICasperTransactionsError {
  return error instanceof CasperTransactionsError && error.name === 'CasperTransactionsError';
}

export class AlreadySignedError extends CasperTransactionsError {
  constructor() {
    super(new Error('errors:already-signed'), 'signature');
  }
}

export class EmptySignatureError extends CasperTransactionsError {
  constructor() {
    super(new Error('errors:empty-signature'), 'signature');
  }
}
