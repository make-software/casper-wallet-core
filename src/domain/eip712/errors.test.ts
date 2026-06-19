import { EIP712Error, isEIP712Error, SignTypedDataErrorCodes } from './errors';

describe('EIP712Error', () => {
  it('carries type, errorCode and a public name', () => {
    const err = new EIP712Error(
      new Error('boom'),
      'validateTypedDataEIP712',
      SignTypedDataErrorCodes.INVALID_PARAMS,
    );

    expect(err.message).toBe('boom');
    expect(err.type).toBe('validateTypedDataEIP712');
    expect(err.errorCode).toBe('INVALID_PARAMS');
    expect(err.name).toBe('EIP712Error');
    expect(err.traceable).toBe(true);
  });

  it('isEIP712Error narrows correctly', () => {
    const err = new EIP712Error(new Error('x'), 'computeDigest');
    expect(isEIP712Error(err)).toBe(true);
    expect(isEIP712Error(new Error('plain'))).toBe(false);
  });
});
