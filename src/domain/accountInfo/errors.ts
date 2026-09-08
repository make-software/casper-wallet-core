import { DomainError, IDomainError } from '../common';
import { IAccountInfoRepository } from './repository';

export type AccountInfoErrorType = keyof IAccountInfoRepository;
export type IAccountInfoError = IDomainError<AccountInfoErrorType>;

export function isAccountInfoError(error: unknown | IAccountInfoError): error is IAccountInfoError {
  return (
    error instanceof AccountInfoError &&
    (<AccountInfoError>error).name === 'AccountInfoRepositoryError'
  );
}

export class AccountInfoError
  extends DomainError<AccountInfoErrorType>
  implements IAccountInfoError
{
  constructor(error: Error | unknown, type: AccountInfoErrorType) {
    super(error, type, 'AccountInfoRepositoryError');
  }
}
