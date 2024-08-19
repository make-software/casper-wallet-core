export interface ILogger {
  log(msg: string | object): void;
  reportError(error: Error | unknown, message?: string): void;
}
