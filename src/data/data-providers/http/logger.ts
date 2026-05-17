import { ApiResponse, Monitor } from 'apisauce';

import { getCurrentTime } from '../../../utils';
import { ILogger } from '../../../domain';

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
