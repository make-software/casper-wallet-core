import { IDomainError } from '../common';

export type FlowErrorType = 'runner-account-mismatch';

export type IFlowError = IDomainError<FlowErrorType>;

/**
 * A flow could not be started. Today the only case is a runner bound to a different account than
 * the one the surface is showing: the swap would be built from, paid by, signed by and delivered
 * to the runner's key, so it must not run.
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
