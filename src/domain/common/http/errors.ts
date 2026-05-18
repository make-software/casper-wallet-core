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
  override name: string = CLIENT_ERROR;
}

export class HttpClientValidationError extends HttpClientError {
  override name = '400 - client validation';
}

export class HttpClientUnauthorizedError extends HttpClientError {
  override name = '401 - client Unauthorized';
}

export class HttpClientForbiddenError extends HttpClientError {
  override name = '403 - client Forbidden';
}

export class HttpClientNotFoundError extends HttpClientError {
  override name = '404 - not found';
}

export class HttpServerError extends HttpError {
  static readonly message = 'errors:server-error';
  override name = SERVER_ERROR;
  override traceable = true;
}

export class HttpConnectionError extends HttpError {
  static readonly message: 'errors:connection-error';
  override name = CONNECTION_ERROR;
}

export class HttpNetworkError extends HttpError {
  static readonly message = 'errors:network-error';
  override name = NETWORK_ERROR;
  override traceable = false;
}

export class HttpTimeoutError extends HttpError {
  static readonly message = 'errors:timeout-error';
  override name = TIMEOUT_ERROR;
  override traceable = false;
}

export class HttpCancelError extends HttpError {
  static readonly message = 'errors:cancel-request-error';
  override name = CANCEL_ERROR;
  override traceable = false;
}

export class HttpUnknownError extends HttpError {
  static readonly message = 'errors:unexpected';
  override name = UNKNOWN_ERROR;
}
