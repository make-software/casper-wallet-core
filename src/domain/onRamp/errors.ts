import { IOnRampRepository } from './repository';
import { IDomainError, isDomainError, isError } from '../common';

export type OnRampErrorType = keyof IOnRampRepository;
export type IOnRampError = IDomainError<OnRampErrorType>;

export function isOnRampError(error: unknown | OnRampError): error is IOnRampError {
  return error instanceof OnRampError && (<OnRampError>error).name === 'OnrampRepositoryError';
}

export class OnRampError extends Error implements IOnRampError {
  constructor(error: Error | unknown, type: keyof IOnRampRepository) {
    if (isError(error)) {
      super(error.message);
      this.stack = error.stack;
      this.traceable = isDomainError(error) ? Boolean(error.traceable) : true;
    } else {
      super(JSON.stringify(error));
      this.traceable = true;
    }

    this.name = 'OnRampRepositoryError';
    this.type = type;
  }

  type: OnRampErrorType;
  traceable: boolean;
}
