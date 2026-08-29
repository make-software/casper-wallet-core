import { IDomainError, isDomainError, isError } from '../common';
import { IDexContractRepository } from './repository';

export type DexErrorType = keyof IDexContractRepository;
export type IDexError = IDomainError<DexErrorType>;

export function isDexError(error: unknown | IDexError): error is IDexError {
  return error instanceof DexError && (<IDexError>error).name === 'DexRepositoryError';
}

export class DexError extends Error implements IDexError {
  constructor(error: Error | unknown, type: DexErrorType) {
    if (isError(error)) {
      super(error.message);
      this.stack = error.stack;
      this.traceable = isDomainError(error) ? Boolean(error.traceable) : true;
    } else {
      super(JSON.stringify(error));
      this.traceable = true;
    }

    this.name = 'DexRepositoryError';
    this.type = type;
  }

  type: DexErrorType;
  traceable: boolean;
}
