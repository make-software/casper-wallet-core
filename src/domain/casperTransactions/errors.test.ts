import {
  AlreadySignedError,
  CasperTransactionsError,
  EmptySignatureError,
  isCasperTransactionsError,
} from './errors';

describe('CasperTransactionsError', () => {
  it('wraps an Error preserving message and stack, traceable by default', () => {
    const inner = new Error('boom');
    const err = new CasperTransactionsError(inner, 'signMessage');
    expect(err.message).toBe('boom');
    expect(err.type).toBe('signMessage');
    expect(err.name).toBe('CasperTransactionsError');
    expect(err.traceable).toBe(true);
    expect(err.stack).toBe(inner.stack);
  });

  it('stringifies non-Error input', () => {
    const err = new CasperTransactionsError({ a: 1 }, 'sendTokenTransfer');
    expect(err.message).toBe('{"a":1}');
    expect(err.traceable).toBe(true);
  });

  it('propagates traceable=false from domain errors', () => {
    const inner = Object.assign(new Error('x'), { type: 't', traceable: false });
    const err = new CasperTransactionsError(inner, 'signTransaction');
    expect(err.traceable).toBe(false);
  });

  it('guard matches only CasperTransactionsError', () => {
    expect(
      isCasperTransactionsError(new CasperTransactionsError(new Error('x'), 'signature')),
    ).toBe(true);
    expect(isCasperTransactionsError(new Error('x'))).toBe(false);
    expect(isCasperTransactionsError(null)).toBe(false);
  });

  it('subclasses carry mobile-compatible message keys', () => {
    expect(new AlreadySignedError().message).toBe('errors:already-signed');
    expect(new EmptySignatureError().message).toBe('errors:empty-signature');
    expect(new AlreadySignedError().type).toBe('signature');
  });
});
