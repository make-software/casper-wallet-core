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
   * The error this one was built from, verbatim — whatever was thrown. Read it to reach the
   * transport or node detail the wrapper's `message` cannot carry; {@link getNodeErrorDetails}
   * does exactly that.
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

    // Non-enumerable and deliberately not `cause`: both are what keep Sentry from chaining the
    // RPC payload — account hashes, full deploy JSON — into events.
    Object.defineProperty(this, 'sourceError', {
      value: error,
      enumerable: false,
      writable: false,
      configurable: true,
    });
  }
}

export interface INodeErrorDetails {
  /** What the node said, verbatim. Never translated, never prefixed. */
  message: string;
  /** JSON-RPC error code, when the failure carried one. */
  code?: number;
  /** HTTP status, when the transport reported one. */
  statusCode?: number;
  /** Whatever the node attached to the JSON-RPC error — shape is the node's business. */
  data?: unknown;
}

const MAX_CHAIN_DEPTH = 16;

/**
 * Pulls node-provided detail out of an error thrown by the transaction layer, walking the
 * `sourceError` chain and matching casper-js-sdk's transport (`statusCode` + `sourceErr`) and
 * JSON-RPC (`code` + `data`) shapes structurally. Returns `null` when the failure carries no
 * node detail; callers render their own copy in that case.
 */
export const getNodeErrorDetails = (error: unknown): INodeErrorDetails | null => {
  const seen = new Set<unknown>();
  let current: unknown = error;
  let statusCode: number | undefined;

  for (let depth = 0; depth < MAX_CHAIN_DEPTH; depth += 1) {
    if (!current || typeof current !== 'object' || seen.has(current)) {
      return null;
    }

    seen.add(current);

    const candidate = current as {
      message?: unknown;
      code?: unknown;
      data?: unknown;
      statusCode?: unknown;
      sourceErr?: unknown;
      sourceError?: unknown;
    };

    if (typeof candidate.statusCode === 'number') {
      statusCode = candidate.statusCode;
    }

    if (typeof candidate.code === 'number' && typeof candidate.message === 'string') {
      return {
        message: candidate.message,
        code: candidate.code,
        ...(statusCode === undefined ? {} : { statusCode }),
        ...(candidate.data === undefined ? {} : { data: candidate.data }),
      };
    }

    const next = candidate.sourceErr ?? candidate.sourceError;

    if (next === undefined) {
      return statusCode !== undefined && typeof candidate.message === 'string'
        ? { message: candidate.message, statusCode }
        : null;
    }

    current = next;
  }

  return null;
};
