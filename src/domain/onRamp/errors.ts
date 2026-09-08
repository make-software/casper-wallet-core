import { IOnRampRepository } from './repository';
import { DomainError, IDomainError } from '../common';

export type OnRampErrorType = keyof IOnRampRepository;
export type IOnRampError = IDomainError<OnRampErrorType>;

export function isOnRampError(error: unknown | OnRampError): error is IOnRampError {
  return error instanceof OnRampError && (<OnRampError>error).name === 'OnRampRepositoryError';
}

export class OnRampError extends DomainError<OnRampErrorType> implements IOnRampError {
  constructor(error: Error | unknown, type: keyof IOnRampRepository) {
    super(error, type, 'OnRampRepositoryError');
  }
}
