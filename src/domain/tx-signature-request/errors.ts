import { IDomainError, isDomainError, isError } from '../common';

export type TxSignatureRequestErrorType =
  | 'invalidSignatureRequest'
  | 'processContractPackage'
  | 'checkWasmProxyRequest'
  | 'getContractPackageRequest';
export type ITxSignatureRequestError = IDomainError<TxSignatureRequestErrorType>;

export function isTxSignatureRequestError(
  error: unknown | ITxSignatureRequestError,
): error is ITxSignatureRequestError {
  return (
    error instanceof TxSignatureRequestError &&
    (<TxSignatureRequestError>error).name === 'TxSignatureRequestRepositoryError'
  );
}

export class TxSignatureRequestError extends Error implements ITxSignatureRequestError {
  constructor(error: Error | unknown, type: TxSignatureRequestErrorType) {
    if (isError(error)) {
      super(error.message);
      this.stack = error.stack;
      this.traceable = isDomainError(error) ? Boolean(error.traceable) : true;
    } else {
      super(JSON.stringify(error));
      this.traceable = true;
    }

    this.name = 'TxSignatureRequestRepositoryError';
    this.type = type;
  }

  type: TxSignatureRequestErrorType;
  traceable: boolean;
}

export class InvalidSignatureRequestError extends TxSignatureRequestError {
  constructor(message?: string) {
    super(new Error(message ?? 'errors:invalid-signature-request'), 'invalidSignatureRequest');
  }
}

export class InvalidTransactionJsonError extends TxSignatureRequestError {
  constructor(message?: string) {
    super(new Error(message ?? 'errors:invalid-transaction-json-error'), 'invalidSignatureRequest');
  }
}
