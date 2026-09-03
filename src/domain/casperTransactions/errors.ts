import { DomainError, IDomainError } from '../common';
import type { ICasperTransactionsRepository } from './repository';

export type CasperTransactionsErrorType = keyof ICasperTransactionsRepository | 'signature';

export type ICasperTransactionsError = IDomainError<CasperTransactionsErrorType>;

export class CasperTransactionsError
  extends DomainError<CasperTransactionsErrorType>
  implements ICasperTransactionsError
{
  constructor(error: Error | unknown, type: CasperTransactionsErrorType) {
    super(error, type, 'CasperTransactionsError');
  }
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

/**
 * The supplied `publicKeyHex` does not belong to the supplied secret key. Raised before signing:
 * the curve is taken from the public key, so a mismatched pair would be caught only by the node,
 * after the payment is committed.
 */
export class KeyPairMismatchError extends CasperTransactionsError {
  constructor() {
    super(new Error('errors:key-pair-mismatch'), 'signature');
  }
}
