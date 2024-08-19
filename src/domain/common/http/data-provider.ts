import { IDomainError } from '../errors';
import {
  AccountInfoErrorType,
  DeploysErrorType,
  NftsErrorType,
  OnRampErrorType,
  TokensErrorType,
  ValidatorsErrorType,
} from '../../../domain';

export interface IHttpDataProvider {
  get: <Response>(params: HttpMethodParamsType) => Promise<Response | undefined>;
  post: <Response>(params: HttpMethodParamsType) => Promise<Response | undefined>;
  patch: <Response>(params: HttpMethodParamsType) => Promise<Response | undefined>;
  put: <Response>(params: HttpMethodParamsType) => Promise<Response | undefined>;
  delete: <Response>(params: HttpMethodParamsType) => Promise<Response | undefined>;
  /** @return {Record<string, string>} headers */
  head: (params: HttpMethodParamsType) => Promise<Record<string, string> | undefined>;

  setUpBaseUrl: (url: string) => void;
  setAuthHeader: (token: string) => void;
  removeAuthHeader: () => void;
}

export type IHttpErrorType =
  | 'unspecified'
  | TokensErrorType
  | DeploysErrorType
  | NftsErrorType
  | ValidatorsErrorType
  | OnRampErrorType
  | AccountInfoErrorType;

export interface IHttpMethodBaseParams {
  url: string;
  errorType: IHttpErrorType;
  params?: Record<string, any>;
  data?: Record<string, any>;
  headers?: Record<string, any>;
  baseURL?: string;
  timeout?: number;
}

export interface IErrorMessagesOptions {
  errorType: IHttpErrorType;
  errorSelector?: (response: any) => string;
}

export type HttpMethodParamsType = IHttpMethodBaseParams & IErrorMessagesOptions;

export interface IMessageError {
  target: Object;
  value: string;
  property: string;
  children: Array<any>;
  constraints: Record<string, string>;
}

export interface IErrorResponse {
  message: string | IMessageError[];
}

export interface IHttpError extends IDomainError {
  type: IHttpErrorType;
  scope?: string;
}

export interface IHttpErrorOptions {
  type: IHttpErrorType;
  status: number;
  scope?: string;
  traceable?: boolean;
  /** JSON.stringify of request */
  data?: string;
}

export interface DataResponse<T> {
  data: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  itemCount: number;
  pageCount: number;
  pages: any[];
}

export interface CloudPaginatedResponse<T> {
  data: T[];
  item_count: number;
  page_count: number;
  pages: any[];
}
