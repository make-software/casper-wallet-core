import { DomainError, IDomainError } from '../common';

export const SignTypedDataErrorCodes = {
  INVALID_PARAMS: 'INVALID_PARAMS',
  DOMAIN_TYPES_REQUIRED: 'DOMAIN_TYPES_REQUIRED',
  UNSUPPORTED_TYPE: 'UNSUPPORTED_TYPE',
} as const;
export type SignTypedDataErrorCode =
  (typeof SignTypedDataErrorCodes)[keyof typeof SignTypedDataErrorCodes];

export type EIP712ErrorType =
  | 'validateTypedDataEIP712'
  | 'resolveDomainTypes'
  | 'computeDigest'
  | 'signDigest'
  | 'signTypedDataEIP712'
  | 'prepareSignatureRequest';

export type IEIP712Error = IDomainError<EIP712ErrorType> & {
  errorCode?: SignTypedDataErrorCode;
};

export function isEIP712Error(error: unknown | IEIP712Error): error is IEIP712Error {
  return error instanceof EIP712Error && (<EIP712Error>error).name === 'EIP712Error';
}

export class EIP712Error extends DomainError<EIP712ErrorType> implements IEIP712Error {
  constructor(error: Error | unknown, type: EIP712ErrorType, errorCode?: SignTypedDataErrorCode) {
    super(error, type, 'EIP712Error');

    this.errorCode = errorCode;
  }

  errorCode?: SignTypedDataErrorCode;
}
