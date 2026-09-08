import { DomainError, IDomainError } from '../common';
import { INftsRepository } from './repository';

export type NftsErrorType = keyof INftsRepository;
export type INftsError = IDomainError<NftsErrorType>;

export function isNftsError(error: unknown | INftsError): error is INftsError {
  return error instanceof NftsError && (<INftsError>error).name === 'NftsRepositoryError';
}

export class NftsError extends DomainError<NftsErrorType> implements INftsError {
  constructor(error: Error | unknown, type: keyof INftsRepository) {
    super(error, type, 'NftsRepositoryError');
  }
}
