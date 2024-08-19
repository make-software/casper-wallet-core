import {
  CLIENT_ERROR,
  SERVER_ERROR,
  CONNECTION_ERROR,
  CANCEL_ERROR,
  NETWORK_ERROR,
  TIMEOUT_ERROR,
  UNKNOWN_ERROR,
} from 'apisauce';
import { IHttpError, IHttpErrorOptions, IHttpErrorType } from './data-provider';
import { Maybe } from '../../../typings';

export function isHttpError(error: unknown | IHttpError): error is IHttpError {
  return error instanceof HttpError && (<IHttpError>error).type !== undefined;
}

export class HttpError extends Error implements IHttpError {
  constructor(message: string, options?: IHttpErrorOptions) {
    super(message);
    this.name = 'HttpError';
    this.status = options?.status ?? -1;
    this.scope = options?.scope ?? `${this.name} - Not specified request scope`;
    this.type = options?.type ?? 'unspecified';
    this.traceable = options?.traceable ?? true;
    this.data = options?.data ?? null;
  }

  scope: string;
  type: IHttpErrorType;
  traceable: boolean;
  data: Maybe<string>;
  status: number;
}

export class HttpClientError extends HttpError {
  name: string = CLIENT_ERROR;
}

export class HttpClientValidationError extends HttpClientError {
  name = '400 - client validation';
}

export class HttpClientUnauthorizedError extends HttpClientError {
  name = '401 - client Unauthorized';
}

export class HttpClientForbiddenError extends HttpClientError {
  name = '403 - client Forbidden';
}

export class HttpClientNotFoundError extends HttpClientError {
  name = '404 - not found';
}

export class HttpServerError extends HttpError {
  static readonly message = 'errors:server-error';
  name = SERVER_ERROR;
  traceable = true;
}

export class HttpConnectionError extends HttpError {
  static readonly message: 'errors:connection-error';
  name = CONNECTION_ERROR;
}

export class HttpNetworkError extends HttpError {
  static readonly message = 'errors:network-error';
  name = NETWORK_ERROR;
  traceable = false;
}

export class HttpTimeoutError extends HttpError {
  static readonly message = 'errors:timeout-error';
  name = TIMEOUT_ERROR;
  traceable = false;
}

export class HttpCancelError extends HttpError {
  static readonly message = 'errors:cancel-request-error';
  name = CANCEL_ERROR;
  traceable = false;
}

export class HttpUnknownError extends HttpError {
  static readonly message = 'errors:unexpected';
  name = UNKNOWN_ERROR;
}
