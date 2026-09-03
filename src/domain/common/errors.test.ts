import { DomainError, isDomainError } from './errors';

class TestError extends DomainError<'test'> {
  constructor(error: unknown) {
    super(error, 'test', 'TestError');
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
});
