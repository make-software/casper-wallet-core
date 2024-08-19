import { IDomainError, isDomainError, isError } from '../common';
import { INftsRepository } from './repository';

export type NftsErrorType = keyof INftsRepository;
export type INftsError = IDomainError<NftsErrorType>;

export function isNftsError(error: unknown | INftsError): error is INftsError {
  return error instanceof NftsError && (<INftsError>error).name === 'NftsRepositoryError';
}

export class NftsError extends Error implements INftsError {
  constructor(error: Error | unknown, type: keyof INftsRepository) {
    if (isError(error)) {
      super(error.message);
      this.stack = error.stack;
      this.traceable = isDomainError(error) ? Boolean(error.traceable) : true;
    } else {
      super(JSON.stringify(error));
      this.traceable = true;
    }

    this.name = 'NftsRepositoryError';
    this.type = type;
  }

  type: NftsErrorType;
  traceable: boolean;
}
