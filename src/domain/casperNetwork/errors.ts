import { IDomainError, isDomainError, isError } from '../common';
import { ICasperTransactionsRepository } from './repository';

type CasperTransactionsErrorType = keyof ICasperTransactionsRepository | 'signature';
type ICasperTransactionsError = IDomainError<CasperTransactionsErrorType>;

export function isCasperTransactionsError(
  error: unknown | ICasperTransactionsError,
): error is ICasperTransactionsError {
  return (
    error instanceof CasperTransactionsError &&
    (<ICasperTransactionsError>error).name === 'CasperNetworkRepositoryError'
  );
}

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

    this.name = 'CasperTransactionsRepositoryError';
    this.type = type;
  }

  type: CasperTransactionsErrorType;
  traceable: boolean;
}

export class UnknownSignatureTypeError extends CasperTransactionsError {
  constructor() {
    super(new Error('errors:unknown-signature'), 'signature');
  }
}

export class EmptySignatureError extends CasperTransactionsError {
  constructor() {
    super(new Error('errors:empty-signature'), 'signature');
  }
}
