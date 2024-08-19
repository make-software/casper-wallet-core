export interface IDomainError<T = string> extends Error {
  type: T;
  traceable: boolean;
}

export function isError(error: unknown | Error): error is Error {
  return error instanceof Error && (<Error>error).message !== undefined;
}

export function isDomainError(err: unknown | IDomainError): err is IDomainError {
  return err instanceof Error && (<IDomainError>err).type !== undefined;
}
