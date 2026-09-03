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

export abstract class DomainError<T = string> extends Error implements IDomainError<T> {
  /**
   * The error this one was built from, verbatim — an `Error`, a rejected non-`Error` value,
   * whatever was thrown. Read it to reach transport or node detail the wrapper's `message`
   * cannot carry; {@link getNodeErrorDetails} does exactly that.
   *
   * `declare` and not a field initializer: `useDefineForClassFields` is on, so a declared field
   * would be re-defined as `undefined` after `super()` and clobber the descriptor set below.
   */
  declare readonly sourceError: unknown;

  type: T;
  traceable: boolean;

  protected constructor(error: Error | unknown, type: T, name: string) {
    if (isError(error)) {
      super(error.message);
      this.stack = error.stack;
      this.traceable = isDomainError(error) ? Boolean(error.traceable) : true;
    } else {
      super(JSON.stringify(error));
      this.traceable = true;
    }

    this.name = name;
    this.type = type;

    // Non-enumerable, and deliberately not `cause`: mobile's Sentry chains `cause` into the
    // event and serializes enumerable own properties, which would carry a nested RPC payload
    // — account hashes, full deploy JSON — past that app's scrubbing depth cap.
    Object.defineProperty(this, 'sourceError', {
      value: error,
      enumerable: false,
      writable: false,
      configurable: true,
    });
  }
}
