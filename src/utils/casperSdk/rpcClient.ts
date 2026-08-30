import { HttpHandler, RpcClient } from 'casper-js-sdk';
import { CSPR_API_PROXY_HEADERS } from '../../domain/constants';
import type { ICasperRpcOptions } from '../../domain';

/** One RPC client construction for every core repository that talks to a node (D6/D14). */
export const createCasperRpcClient = (url: string, options: ICasperRpcOptions = {}): RpcClient => {
  const { handlerType = 'fetch', referrerMode = 'fetch-referrer', authorizationHeader } = options;

  const handler = new HttpHandler(url, handlerType);
  const customHeaders: Record<string, string> = {};

  if (referrerMode === 'referer-header') {
    customHeaders.Referer = CSPR_API_PROXY_HEADERS.Referer;
  } else {
    handler.setReferrer(CSPR_API_PROXY_HEADERS.Referer);
  }

  if (authorizationHeader) {
    customHeaders.Authorization = authorizationHeader;
  }

  if (Object.keys(customHeaders).length > 0) {
    handler.setCustomHeaders(customHeaders);
  }

  return new RpcClient(handler);
};
