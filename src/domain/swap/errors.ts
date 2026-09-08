import { DomainError, HttpError, IDomainError } from '../common';
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

export class SwapError extends DomainError<SwapErrorType> implements ISwapError {
  constructor(error: Error | unknown, type: keyof ISwapRepository) {
    super(error, type, 'SwapRepositoryError');

    // The trade API reports quote failures as a code in the response body
    // (`FetchQuoteErrorCodes`); keep the envelope so consumers can still read it after wrapping.
    if (error instanceof HttpError) {
      this.data = error.data;
      this.status = error.status;
    }
  }

  data?: Maybe<string>;
  status?: number;
}
