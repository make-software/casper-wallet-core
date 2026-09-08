import { IDomainError } from '../common';

export type FlowErrorType = 'runner-account-mismatch';

export type IFlowError = IDomainError<FlowErrorType>;

/**
 * A flow could not be started. `runner-account-mismatch`: the runner is bound to a different
 * account than the active one, so the flow would run against the runner's key.
 */
export class FlowError extends Error implements IFlowError {
  constructor(type: FlowErrorType) {
    super(`errors:flow-${type}`);

    this.name = 'FlowError';
    this.type = type;
  }

  type: FlowErrorType;
  traceable = true;
}

export function isFlowError(error: unknown | IFlowError): error is IFlowError {
  return error instanceof FlowError && error.name === 'FlowError';
}
