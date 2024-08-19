import { IDomainError, isDomainError, isError } from '../common';
import { ITokensRepository } from './repository';

export type TokensErrorType = keyof ITokensRepository;
export type ITokensError = IDomainError<TokensErrorType>;

export function isTokensError(error: unknown | ITokensError): error is ITokensError {
  return error instanceof TokensError && (<ITokensError>error).name === 'TokensRepositoryError';
}

export class TokensError extends Error implements ITokensError {
  constructor(error: Error | unknown, type: keyof ITokensRepository) {
    if (isError(error)) {
      super(error.message);
      this.stack = error.stack;
      this.traceable = isDomainError(error) ? Boolean(error.traceable) : true;
    } else {
      super(JSON.stringify(error));
      this.traceable = true;
    }

    this.name = 'TokensRepositoryError';
    this.type = type;
  }

  type: TokensErrorType;
  traceable: boolean;
}
