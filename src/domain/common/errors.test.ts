import { DomainError, getNodeErrorDetails, isDomainError } from './errors';

class TestError extends DomainError<'test'> {
  constructor(error: unknown) {
    super(error, 'test', 'TestError');
  }
}

class QuietError extends DomainError<'test'> {
  constructor(error: unknown, traceable = false) {
    super(error, 'test', 'QuietError', traceable);
  }
}

describe('DomainError', () => {
  it('wraps an Error preserving message, stack and traceable', () => {
    const inner = new Error('boom');
    const err = new TestError(inner);

    expect(err.message).toBe('boom');
    expect(err.stack).toBe(inner.stack);
    expect(err.traceable).toBe(true);
    expect(err.name).toBe('TestError');
    expect(err.type).toBe('test');
  });

  it('propagates traceable=false from a wrapped domain error', () => {
    const inner = Object.assign(new Error('x'), { type: 't', traceable: false });

    expect(new TestError(inner).traceable).toBe(false);
  });

  it('stringifies a non-Error and a string', () => {
    expect(new TestError({ a: 1 }).message).toBe('{"a":1}');
    expect(new TestError('plain failure').message).toBe('"plain failure"');
    expect(new TestError({ a: 1 }).traceable).toBe(true);
  });

  it('keeps the source error by reference, for both branches', () => {
    const inner = new Error('boom');
    const raw = { a: 1 };

    expect(new TestError(inner).sourceError).toBe(inner);
    expect(new TestError(raw).sourceError).toBe(raw);
  });

  it('keeps sourceError out of enumeration and serialization', () => {
    const err = new TestError(new Error('boom'));

    expect(Object.keys(err)).not.toContain('sourceError');
    expect(JSON.stringify(err)).not.toContain('sourceError');
    expect('sourceError' in err).toBe(true);
    expect(Object.getOwnPropertyDescriptor(err, 'sourceError')?.enumerable).toBe(false);
  });

  it('does not populate the standard cause property', () => {
    expect(new TestError(new Error('boom')).cause).toBeUndefined();
  });

  it('is a real Error and a domain error', () => {
    const err = new TestError(new Error('boom'));

    expect(err).toBeInstanceOf(DomainError);
    expect(err).toBeInstanceOf(Error);
    expect(isDomainError(err)).toBe(true);
  });

  it('nests', () => {
    const root = new Error('root');
    const inner = new TestError(root);
    const outer = new TestError(inner);

    expect(outer.sourceError).toBe(inner);
    expect((outer.sourceError as TestError).sourceError).toBe(root);
  });

  it('applies the traceable argument on both wrapping branches', () => {
    expect(new QuietError(new Error('boom')).traceable).toBe(false);
    expect(new QuietError({ a: 1 }).traceable).toBe(false);
    expect(new QuietError('plain failure').traceable).toBe(false);
    expect(new QuietError(new Error('boom'), true).traceable).toBe(true);
  });

  it('lets a wrapped domain error outrank the traceable argument', () => {
    const silenced = new QuietError(new Error('boom'));
    const noisy = new TestError(new Error('boom'));

    expect(new QuietError(silenced, true).traceable).toBe(false);
    expect(new QuietError(noisy).traceable).toBe(true);
  });
});

const rpcError = (over: Partial<{ code: number; message: string; data: unknown }> = {}) =>
  Object.assign(new Error(over.message ?? 'invalid deploy'), {
    code: over.code ?? -32008,
    data: 'data' in over ? over.data : 'bad hash',
  });

const transportError = (sourceErr: Error, statusCode = 500) =>
  Object.assign(new Error(`Code: ${statusCode}, err: ${sourceErr.message}`), {
    statusCode,
    sourceErr,
  });

describe('getNodeErrorDetails', () => {
  it('reads a wrapped transport + JSON-RPC failure', () => {
    const inner = transportError(rpcError());

    expect(getNodeErrorDetails(new TestError(inner))).toEqual({
      message: 'invalid deploy',
      code: -32008,
      statusCode: 500,
      data: 'bad hash',
    });
  });

  it('reads a bare transport error', () => {
    expect(getNodeErrorDetails(transportError(new Error('gateway'), 502))).toEqual({
      message: 'gateway',
      statusCode: 502,
    });
  });

  it('reads a bare JSON-RPC error', () => {
    expect(getNodeErrorDetails(rpcError())).toEqual({
      message: 'invalid deploy',
      code: -32008,
      data: 'bad hash',
    });
  });

  it('finds detail through nested domain errors', () => {
    const inner = transportError(rpcError({ message: 'deep' }));

    expect(getNodeErrorDetails(new TestError(new TestError(inner)))?.message).toBe('deep');
  });

  it('returns null when there is no node detail', () => {
    expect(getNodeErrorDetails(new Error('boom'))).toBeNull();
    expect(getNodeErrorDetails(new TestError(new Error('boom')))).toBeNull();
    expect(getNodeErrorDetails(null)).toBeNull();
    expect(getNodeErrorDetails(undefined)).toBeNull();
    expect(getNodeErrorDetails('string')).toBeNull();
    expect(getNodeErrorDetails({})).toBeNull();
  });

  it('returns null for a fixed-message domain error', () => {
    expect(getNodeErrorDetails(new TestError(new Error('errors:key-pair-mismatch')))).toBeNull();
  });

  it('passes structured data through untouched', () => {
    const data = { reason: 'bad hash' };

    expect(getNodeErrorDetails(rpcError({ data }))?.data).toBe(data);
  });

  it('terminates on a cyclic chain', () => {
    const err = new Error('loop') as Error & { sourceErr?: unknown; statusCode?: number };
    err.sourceErr = err;
    err.statusCode = 500;

    expect(() => getNodeErrorDetails(err)).not.toThrow();
  });
});
