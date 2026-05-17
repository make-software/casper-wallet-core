import type { HttpMethodParamsType, IHttpDataProvider } from '../domain';

export interface MockHttpProvider extends IHttpDataProvider {
  get: jest.Mock<Promise<any>, [HttpMethodParamsType]>;
  post: jest.Mock<Promise<any>, [HttpMethodParamsType]>;
  patch: jest.Mock<Promise<any>, [HttpMethodParamsType]>;
  put: jest.Mock<Promise<any>, [HttpMethodParamsType]>;
  delete: jest.Mock<Promise<any>, [HttpMethodParamsType]>;
  head: jest.Mock<Promise<Record<string, string> | undefined>, [HttpMethodParamsType]>;
  setUpBaseUrl: jest.Mock<void, [string]>;
  setAuthHeader: jest.Mock<void, [string]>;
  removeAuthHeader: jest.Mock<void, []>;
}

export const createMockHttpProvider = (): MockHttpProvider => ({
  get: jest.fn().mockResolvedValue(undefined),
  post: jest.fn().mockResolvedValue(undefined),
  patch: jest.fn().mockResolvedValue(undefined),
  put: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue(undefined),
  head: jest.fn().mockResolvedValue(undefined),
  setUpBaseUrl: jest.fn(),
  setAuthHeader: jest.fn(),
  removeAuthHeader: jest.fn(),
});
