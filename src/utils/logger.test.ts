import { Logger } from './logger';

describe('Logger', () => {
  let logSpy: jest.SpyInstance;
  let groupSpy: jest.SpyInstance;
  let groupEndSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    groupSpy = jest.spyOn(console, 'group').mockImplementation(() => undefined);
    groupEndSpy = jest.spyOn(console, 'groupEnd').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('log() forwards arguments to console.log with a dash prefix', () => {
    new Logger().log('hello', 'world');
    expect(logSpy).toHaveBeenCalledWith('--------', 'hello', 'world');
  });

  it('logGroup() calls console.group', () => {
    new Logger().logGroup('my-group');
    expect(groupSpy).toHaveBeenCalledWith('my-group');
  });

  it('logGroupEnd() calls console.groupEnd', () => {
    new Logger().logGroupEnd();
    expect(groupEndSpy).toHaveBeenCalledTimes(1);
  });

  it('reportError() logs with the current time and message', () => {
    const err = new Error('boom');
    new Logger().reportError(err, 'context');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [first, second] = errorSpy.mock.calls[0];
    expect(first).toMatch(/\d{2}:\d{2}:\d{2} --- error context/);
    expect(second).toBe(err);
  });

  it('reportError() works without a message', () => {
    new Logger().reportError('non-error');
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});
