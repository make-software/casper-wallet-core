import { DomainError, IDomainError } from '../common';
import { IDexContractRepository } from './repository';

export type DexErrorType = keyof IDexContractRepository;
export type IDexError = IDomainError<DexErrorType>;

export function isDexError(error: unknown | IDexError): error is IDexError {
  return error instanceof DexError && (<IDexError>error).name === 'DexRepositoryError';
}

export class DexError extends DomainError<DexErrorType> implements IDexError {
  constructor(error: Error | unknown, type: DexErrorType) {
    super(error, type, 'DexRepositoryError');
  }
}
