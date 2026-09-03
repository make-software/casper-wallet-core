import { DomainError, IDomainError } from '../common';
import { ITokensRepository } from './repository';

export type TokensErrorType = keyof ITokensRepository;
export type ITokensError = IDomainError<TokensErrorType>;

export function isTokensError(error: unknown | ITokensError): error is ITokensError {
  return error instanceof TokensError && (<ITokensError>error).name === 'TokensRepositoryError';
}

export class TokensError extends DomainError<TokensErrorType> implements ITokensError {
  constructor(error: Error | unknown, type: keyof ITokensRepository) {
    super(error, type, 'TokensRepositoryError');
  }
}
