import { IContractPackageRepository } from './repository';
import { DomainError } from '../common';
import { IDomainError } from '../common';

export type ContractPackageErrorType = keyof IContractPackageRepository;
export type IContractPackageError = IDomainError<ContractPackageErrorType>;

export function isContractPackageError(
  error: unknown | ContractPackageError,
): error is IContractPackageError {
  return (
    error instanceof ContractPackageError &&
    (<ContractPackageError>error).name === 'ContractPackageRepositoryError'
  );
}

export class ContractPackageError
  extends DomainError<ContractPackageErrorType>
  implements IContractPackageError
{
  constructor(error: Error | unknown, type: keyof IContractPackageRepository) {
    super(error, type, 'ContractPackageRepositoryError');
  }
}
