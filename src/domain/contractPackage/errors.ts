import { IContractPackageRepository } from './repository';
import { isDomainError, isError } from '../common';
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

export class ContractPackageError extends Error implements IContractPackageError {
  constructor(error: Error | unknown, type: keyof IContractPackageRepository) {
    if (isError(error)) {
      super(error.message);
      this.stack = error.stack;
      this.traceable = isDomainError(error) ? Boolean(error.traceable) : true;
    } else {
      super(JSON.stringify(error));
      this.traceable = true;
    }

    this.name = 'ContractPackageRepositoryError';
    this.type = type;
  }

  type: ContractPackageErrorType;
  traceable: boolean;
}
