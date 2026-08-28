import { ApiResponse, Monitor } from 'apisauce';

// Deep imports, not the `utils` / `domain` barrels: those re-export the SDK-backed transfer
// builders and EIP-712 signer, which would put `casper-js-sdk` behind every HTTP call.
import { getCurrentTime } from '../../../utils/date';
import type { ILogger } from '../../../domain/common/logger';

const logRequestResult = (
  { config, status, originalError, ok, data }: ApiResponse<unknown>,
  logger: ILogger,
) => {
  if (!config) return;

  const { method, url, baseURL, params, responseType } = config;

  const param = Object.entries(params ?? {})
    .map(([key, value]) => `${key} - ${value}`)
    .join(', ');

  const error = !ok
    ? `Error - ${originalError?.name} - ${originalError?.message} ${originalError?.code ?? ''}`
    : '';

  logger.logGroup(`${getCurrentTime()} - ${status} ${method} - ${baseURL}${url}`);
  param && logger.log('params --- ', param);
  responseType !== 'arraybuffer' && logger.log('response --- ', data);
  error && logger.log('errors --- ', error);
  logger.logGroupEnd();
};

export const makeLogRequestMonitor =
  (logger: ILogger): Monitor =>
  response => {
    logRequestResult(response, logger);
  };
