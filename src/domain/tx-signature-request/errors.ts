import { DomainError, IDomainError } from '../common';

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

export class TxSignatureRequestError
  extends DomainError<TxSignatureRequestErrorType>
  implements ITxSignatureRequestError
{
  constructor(error: Error | unknown, type: TxSignatureRequestErrorType) {
    super(error, type, 'TxSignatureRequestRepositoryError');
  }
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
