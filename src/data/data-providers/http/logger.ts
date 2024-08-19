import { ApiResponse, Monitor } from 'apisauce';

import { getCurrentTime } from '../../../utils';
import { ILogger } from '../../../domain';

const logRequestResult = (
  { config, status, originalError, ok, data }: ApiResponse<unknown>,
  logger: ILogger,
) => {
  if (config) {
    const { method, url, baseURL, params } = config;

    const param = Object.entries(params)
      .map(([key, value]) => `${key} - ${value}`)
      .join(', ');

    const error = !ok
      ? `Error - ${originalError?.name} - ${originalError?.message} ${originalError?.code ?? ''}`
      : '';

    const response = ok ? `response - ${JSON.stringify(data, null, ' ')}` : '';

    logger.log(`${getCurrentTime()} - ${status} ${method} - ${baseURL}${url}
${param}
${response}
${error}
`);
  }
};

export const makeLogRequestMonitor =
  (logger: ILogger): Monitor =>
  response => {
    logRequestResult(response, logger);
  };
