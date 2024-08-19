import { ILogger } from '../domain';
import { getCurrentTime } from './date';

export class Logger implements ILogger {
  log(msg: string | object) {
    const message = typeof msg === 'string' ? msg : JSON.stringify(msg, null, ' ');

    console.log('--------', message);
  }

  reportError(error: Error | unknown, message?: string) {
    console.error(`${getCurrentTime()} --- error ${message ?? ''}`, error);
  }
}
