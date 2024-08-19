import { ApiErrorResponse, ApiResponse, ApisauceInstance, create } from 'apisauce';

import {
  HttpCancelError,
  HttpClientError,
  HttpClientForbiddenError,
  HttpClientUnauthorizedError,
  HttpClientValidationError,
  HttpConnectionError,
  HttpNetworkError,
  HttpServerError,
  HttpTimeoutError,
  HttpUnknownError,
  REQUEST_TIMEOUT,
  HttpClientNotFoundError,
  IHttpDataProvider,
  HttpMethodParamsType,
  IErrorResponse,
  IErrorMessagesOptions,
  IHttpErrorOptions,
} from '../../../domain';
import type { ILogger } from '../../../domain';

import { makeLogRequestMonitor } from './logger';
import { Maybe } from '../../../typings';

export class HttpDataProvider implements IHttpDataProvider {
  static AUTH_HEADER_KEY = 'Authorization';

  private instance: ApisauceInstance;

  constructor(private _logger: Maybe<ILogger>) {
    this.instance = create({
      baseURL: '',
      timeout: REQUEST_TIMEOUT,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });

    if (this._logger) {
      this.instance.addMonitor(makeLogRequestMonitor(this._logger));
    }
  }

  setUpBaseUrl(url = '') {
    this.instance.setBaseURL(url);
  }

  async get<Response>({
    url,
    params = {},
    headers = {},
    errorSelector,
    baseURL,
    errorType,
    timeout,
  }: HttpMethodParamsType) {
    const response = await this.instance.get<Response, IErrorResponse>(url, params, {
      headers,
      baseURL,
      timeout,
    });

    return this.handleResponse<Response>(response, {
      errorType,
      errorSelector,
    });
  }

  async post<Response>({
    url,
    data,
    headers = {},
    errorSelector,
    baseURL,
    timeout,
    errorType,
  }: HttpMethodParamsType) {
    const response = await this.instance.post<Response, IErrorResponse>(url, data, {
      headers,
      baseURL,
      timeout,
    });

    return this.handleResponse<Response>(response, {
      errorType,
      errorSelector,
    });
  }

  async patch<Response>({
    url,
    data,
    headers = {},
    errorSelector,
    baseURL,
    errorType,
    timeout,
  }: HttpMethodParamsType) {
    const response = await this.instance.patch<Response, IErrorResponse>(url, data, {
      headers,
      baseURL,
      timeout,
    });

    return this.handleResponse<Response>(response, {
      errorType,
      errorSelector,
    });
  }

  async put<Response>({
    url,
    data,
    headers = {},
    errorSelector,
    errorType,
    timeout,
    baseURL,
  }: HttpMethodParamsType) {
    const response = await this.instance.put<Response, IErrorResponse>(url, data, {
      headers,
      baseURL,
      timeout,
    });

    return this.handleResponse<Response>(response, {
      errorType,
      errorSelector,
    });
  }

  async delete<Response>({
    url,
    data,
    params = {},
    headers = {},
    errorSelector,
    baseURL,
    errorType,
    timeout,
  }: HttpMethodParamsType) {
    const response = await this.instance.delete<Response, IErrorResponse>(url, params, {
      headers,
      baseURL,
      data,
      timeout,
    });

    return this.handleResponse<Response>(response, {
      errorType,
      errorSelector,
    });
  }

  async head({
    url,
    params,
    timeout,
    baseURL,
    headers,
    errorType,
    errorSelector,
  }: HttpMethodParamsType) {
    const response = await this.instance.head<IErrorResponse>(url, params, {
      headers,
      baseURL,
      timeout,
    });

    if (response.ok) {
      return response.headers;
    }

    this.handleError(response, {
      errorType,
      errorSelector,
    });
  }

  setAuthHeader(token: string) {
    this.instance.setHeader(HttpDataProvider.AUTH_HEADER_KEY, `Bearer ${token}`);
  }

  removeAuthHeader() {
    this.instance.deleteHeader(HttpDataProvider.AUTH_HEADER_KEY);
  }

  protected handleError(
    response: ApiErrorResponse<IErrorResponse>,
    { errorType: type, errorSelector }: IErrorMessagesOptions,
  ) {
    const { data, status = -1, headers, duration, config: { params, method, url } = {} } = response;

    const options: IHttpErrorOptions = {
      type,
      status: status,
      scope: `${status} - ${method} - ${url}`,
      data: JSON.stringify({ status, method, url, params, headers, data, duration }),
    };

    switch (response.problem) {
      case 'CLIENT_ERROR': {
        if (response.status === 400) {
          this._handle400Errors(response, options);
        } else if (response.status === 401) {
          this._handle401Errors(response, options);
        } else if (response.status === 403) {
          this._handle403Errors(response, options);
        } else if (response.status === 404) {
          this._handle404Errors(response, options);
        }

        if (errorSelector && response.data && errorSelector(response.data)) {
          throw new HttpClientError(errorSelector(response.data), options);
        }

        const message = this._getErrorMessageFromResponse(response, 'errors:unexpected-http');

        throw new HttpClientError(message, options);
      }
      case 'SERVER_ERROR':
        this._handleServerErrors(response, options);
        throw new HttpServerError(HttpServerError.message, options);
      case 'TIMEOUT_ERROR':
        throw new HttpTimeoutError(HttpTimeoutError.message, options);
      case 'CONNECTION_ERROR':
        throw new HttpConnectionError(HttpConnectionError.message, options);
      case 'NETWORK_ERROR':
        throw new HttpNetworkError(HttpNetworkError.message, options);
      case 'UNKNOWN_ERROR':
        throw new HttpUnknownError(HttpUnknownError.message, options);
      case 'CANCEL_ERROR':
        throw new HttpCancelError(HttpCancelError.message, options);
      default:
        throw new HttpUnknownError(HttpUnknownError.message, options);
    }
  }

  protected handleResponse<Response>(
    response: ApiResponse<Response, IErrorResponse>,
    errorOptions: IErrorMessagesOptions,
  ) {
    if (response.ok) {
      return response.data;
    }

    this.handleError(response, errorOptions);
  }

  private _handle403Errors(resp: ApiErrorResponse<IErrorResponse>, options: IHttpErrorOptions) {
    const message = this._getErrorMessageFromResponse(resp, 'errors:forbidden');
    throw new HttpClientForbiddenError(message, options);
  }

  private _handle401Errors(resp: ApiErrorResponse<IErrorResponse>, options: IHttpErrorOptions) {
    const message = this._getErrorMessageFromResponse(resp, 'errors:unauthorized');
    throw new HttpClientUnauthorizedError(message, options);
  }

  private _handle400Errors(response: ApiErrorResponse<IErrorResponse>, options: IHttpErrorOptions) {
    const message = this._getErrorMessageFromResponse(response, 'errors:client-validation');
    throw new HttpClientValidationError(message, options);
  }

  private _handle404Errors(response: ApiErrorResponse<IErrorResponse>, options: IHttpErrorOptions) {
    const message = this._getErrorMessageFromResponse(response, 'errors:not-found');
    throw new HttpClientNotFoundError(message, options);
  }

  private _handleServerErrors(
    response: ApiErrorResponse<IErrorResponse>,
    options: IHttpErrorOptions,
  ) {
    const errorsMap: Record<number, string> = {
      500: 'errors:server-500-error',
      502: 'errors:server-502-error',
      503: 'errors:server-503-error',
      504: 'errors:server-504-error',
      506: 'errors:server-506-error',
      507: 'errors:server-507-error',
      508: 'errors:server-508-error',
      510: 'errors:server-510-error',
    };

    const message = response.status ? errorsMap[response.status] : HttpServerError.message;

    throw new HttpServerError(message ?? HttpServerError.message, options);
  }

  private _getErrorMessageFromResponse(
    resp: ApiErrorResponse<IErrorResponse>,
    defaultMessage: string,
  ): string {
    if (!resp.data?.message) {
      return defaultMessage;
    }

    if (typeof resp.data.message === 'string') {
      return resp.data.message;
    } else if (Array.isArray(resp.data?.message)) {
      const error = resp.data.message[0];

      return Object.values(error.constraints).join(', ');
    }

    return defaultMessage;
  }
}
