import { HttpError, IDomainError, isDomainError, isError } from '../common';
import { ISwapRepository } from './repository';
import { Maybe } from '../../typings';

export type SwapErrorType = keyof ISwapRepository;
export type ISwapError = IDomainError<SwapErrorType> & {
  /** JSON envelope of the failed response, carried over from `HttpError` when there was one. */
  data?: Maybe<string>;
  status?: number;
};

export function isSwapError(error: unknown | ISwapError): error is ISwapError {
  return error instanceof SwapError && (<ISwapError>error).name === 'SwapRepositoryError';
}

export class SwapError extends Error implements ISwapError {
  constructor(error: Error | unknown, type: keyof ISwapRepository) {
    if (isError(error)) {
      super(error.message);
      this.stack = error.stack;
      this.traceable = isDomainError(error) ? Boolean(error.traceable) : true;
    } else {
      super(JSON.stringify(error));
      this.traceable = true;
    }

    // The trade API reports quote failures as a code in the response body
    // (`FetchQuoteErrorCodes`); keep the envelope so consumers can still read it after wrapping.
    if (error instanceof HttpError) {
      this.data = error.data;
      this.status = error.status;
    }

    this.name = 'SwapRepositoryError';
    this.type = type;
  }

  type: SwapErrorType;
  traceable: boolean;
  data?: Maybe<string>;
  status?: number;
}
