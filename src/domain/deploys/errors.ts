import { DomainError, IDomainError } from '../common';
import { IDeploysRepository } from './repository';

export type DeploysErrorType = keyof IDeploysRepository | 'deployRpcError' | 'invalidDeploy';
export type IDeployError = IDomainError<DeploysErrorType>;

export function isDeploysError(error: unknown | IDeployError): error is IDeployError {
  return error instanceof DeploysError && (<DeploysError>error).name === 'DeploysRepositoryError';
}

export class DeploysError extends DomainError<DeploysErrorType> implements IDeployError {
  constructor(error: Error | unknown, type: DeploysErrorType) {
    super(error, type, 'DeploysRepositoryError');
  }
}

export class InvalidDeployError extends DeploysError {
  constructor(message?: string) {
    super(new Error(message ?? 'errors:invalid-deploy'), 'invalidDeploy');
  }
}
