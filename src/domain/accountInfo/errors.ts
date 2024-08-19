import { IDomainError, isDomainError, isError } from '../common';
import { IAccountInfoRepository } from './repository';

export type AccountInfoErrorType = keyof IAccountInfoRepository;
export type IAccountInfoError = IDomainError<AccountInfoErrorType>;

export function isAccountInfoError(error: unknown | IAccountInfoError): error is IAccountInfoError {
  return (
    error instanceof AccountInfoError &&
    (<AccountInfoError>error).name === 'AccountInfoRepositoryError'
  );
}

export class AccountInfoError extends Error implements IAccountInfoError {
  constructor(error: Error | unknown, type: AccountInfoErrorType) {
    if (isError(error)) {
      super(error.message);
      this.stack = error.stack;
      this.traceable = isDomainError(error) ? Boolean(error.traceable) : true;
    } else {
      super(JSON.stringify(error));
      this.traceable = true;
    }

    this.name = 'AccountInfoRepositoryError';
    this.type = type;
  }

  type: AccountInfoErrorType;
  traceable: boolean;
}
