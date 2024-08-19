import { IDomainError, isDomainError, isError } from '../common';
import { IValidatorsRepository } from './repository';

export type ValidatorsErrorType = keyof IValidatorsRepository;
export type IValidatorsError = IDomainError<ValidatorsErrorType>;

export function isValidatorsError(error: unknown | IValidatorsError): error is IValidatorsError {
  return (
    error instanceof ValidatorsError &&
    (<IValidatorsError>error).name === 'ValidatorsRepositoryError'
  );
}

export class ValidatorsError extends Error implements IValidatorsError {
  constructor(error: Error | unknown, type: keyof IValidatorsRepository) {
    if (isError(error)) {
      super(error.message);
      this.stack = error.stack;
      this.traceable = isDomainError(error) ? Boolean(error.traceable) : true;
    } else {
      super(JSON.stringify(error));
      this.traceable = true;
    }

    this.name = 'ValidatorsRepositoryError';
    this.type = type;
  }

  type: ValidatorsErrorType;
  traceable: boolean;
}
