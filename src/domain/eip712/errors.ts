import { IDomainError, isDomainError, isError } from '../common';

export const SignTypedDataErrorCodes = {
  INVALID_PARAMS: 'INVALID_PARAMS',
  DOMAIN_TYPES_REQUIRED: 'DOMAIN_TYPES_REQUIRED',
  UNSUPPORTED_TYPE: 'UNSUPPORTED_TYPE',
} as const;
export type SignTypedDataErrorCode =
  (typeof SignTypedDataErrorCodes)[keyof typeof SignTypedDataErrorCodes];

export type EIP712ErrorType =
  | 'validateTypedData'
  | 'resolveDomainTypes'
  | 'computeDigest'
  | 'signDigest'
  | 'signTypedData';

export type IEIP712Error = IDomainError<EIP712ErrorType> & {
  errorCode?: SignTypedDataErrorCode;
};

export function isEIP712Error(error: unknown | IEIP712Error): error is IEIP712Error {
  return error instanceof EIP712Error && (<EIP712Error>error).name === 'EIP712Error';
}

export class EIP712Error extends Error implements IEIP712Error {
  constructor(error: Error | unknown, type: EIP712ErrorType, errorCode?: SignTypedDataErrorCode) {
    if (isError(error)) {
      super(error.message);
      this.stack = error.stack;
      this.traceable = isDomainError(error) ? Boolean(error.traceable) : true;
    } else {
      super(JSON.stringify(error));
      this.traceable = true;
    }

    this.name = 'EIP712Error';
    this.type = type;
    this.errorCode = errorCode;
  }

  type: EIP712ErrorType;
  traceable: boolean;
  errorCode?: SignTypedDataErrorCode;
}
