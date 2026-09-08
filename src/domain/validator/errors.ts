import { DomainError, IDomainError } from '../common';
import { IValidatorsRepository } from './repository';

export type ValidatorsErrorType = keyof IValidatorsRepository;
export type IValidatorsError = IDomainError<ValidatorsErrorType>;

export function isValidatorsError(error: unknown | IValidatorsError): error is IValidatorsError {
  return (
    error instanceof ValidatorsError &&
    (<IValidatorsError>error).name === 'ValidatorsRepositoryError'
  );
}

export class ValidatorsError extends DomainError<ValidatorsErrorType> implements IValidatorsError {
  constructor(error: Error | unknown, type: keyof IValidatorsRepository) {
    super(error, type, 'ValidatorsRepositoryError');
  }
}
