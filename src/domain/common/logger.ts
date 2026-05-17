export interface ILogger {
  log(...params: Parameters<typeof console.log>): void;
  logGroup(msg: string): void;
  logGroupEnd(): void;
  reportError(error: Error | unknown, message?: string): void;
}
