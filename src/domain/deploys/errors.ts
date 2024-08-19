import { IDomainError, isDomainError, isError } from '../common';
import { IDeploysRepository } from './repository';

export type DeploysErrorType = keyof IDeploysRepository | 'deployRpcError' | 'invalidDeploy';
export type IDeployError = IDomainError<DeploysErrorType>;

export function isDeploysError(error: unknown | IDeployError): error is IDeployError {
  return error instanceof DeploysError && (<DeploysError>error).name === 'DeploysRepositoryError';
}

export class DeploysError extends Error implements IDeployError {
  constructor(error: Error | unknown, type: DeploysErrorType) {
    if (isError(error)) {
      super(error.message);
      this.stack = error.stack;
      this.traceable = isDomainError(error) ? Boolean(error.traceable) : true;
    } else {
      super(JSON.stringify(error));
      this.traceable = true;
    }

    this.name = 'DeploysRepositoryError';
    this.type = type;
  }

  type: DeploysErrorType;
  traceable: boolean;
}

export class InvalidDeployError extends DeploysError {
  constructor(message?: string) {
    super(new Error(message ?? 'errors:invalid-deploy'), 'invalidDeploy');
  }
}
