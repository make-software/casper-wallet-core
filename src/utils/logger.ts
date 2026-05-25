import { ILogger } from '../domain';
import { getCurrentTime } from './date';

export class Logger implements ILogger {
  log(...params: Parameters<typeof console.log>) {
    console.log('--------', ...params);
  }

  logGroup(msg: string) {
    console.group(msg);
  }

  logGroupEnd() {
    console.groupEnd();
  }

  reportError(error: Error | unknown, message?: string) {
    console.error(`${getCurrentTime()} --- error ${message ?? ''}`, error);
  }
}
