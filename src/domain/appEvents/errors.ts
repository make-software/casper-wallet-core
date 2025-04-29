import { IAppEventsRepository } from './repository';
import { isDomainError, isError } from '../common';
import { IDomainError } from '../common';

export type AppEventsErrorType = keyof IAppEventsRepository;
export type IAppEventsError = IDomainError<AppEventsErrorType>;

export function isAppEventsError(error: unknown | AppEventsError): error is IAppEventsError {
  return (
    error instanceof AppEventsError && (<AppEventsError>error).name === 'AppEventsRepositoryError'
  );
}

export class AppEventsError extends Error implements IAppEventsError {
  constructor(error: Error | unknown, type: keyof IAppEventsRepository) {
    if (isError(error)) {
      super(error.message);
      this.stack = error.stack;
      this.traceable = isDomainError(error) ? Boolean(error.traceable) : true;
    } else {
      super(JSON.stringify(error));
      this.traceable = true;
    }

    this.name = 'AppEventsRepositoryError';
    this.type = type;
  }

  type: AppEventsErrorType;
  traceable: boolean;
}
