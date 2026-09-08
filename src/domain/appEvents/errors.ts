import { IAppEventsRepository } from './repository';
import { DomainError } from '../common';
import { IDomainError } from '../common';

export type AppEventsErrorType = keyof IAppEventsRepository;
export type IAppEventsError = IDomainError<AppEventsErrorType>;

export function isAppEventsError(error: unknown | AppEventsError): error is IAppEventsError {
  return (
    error instanceof AppEventsError && (<AppEventsError>error).name === 'AppEventsRepositoryError'
  );
}

export class AppEventsError extends DomainError<AppEventsErrorType> implements IAppEventsError {
  constructor(error: Error | unknown, type: keyof IAppEventsRepository) {
    super(error, type, 'AppEventsRepositoryError');
  }
}
