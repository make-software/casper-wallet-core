import type { Transaction } from 'casper-js-sdk';
import {
  createCasperMessageBytes,
  getPrivateKeyHexFromSecretKey,
  isTransactionSignedBy,
} from './transactions';

describe('getPrivateKeyHexFromSecretKey', () => {
  it('truncates legacy 128-char secrets to 64', () => {
    expect(getPrivateKeyHexFromSecretKey('a'.repeat(128))).toBe('a'.repeat(64));
  });
  it('keeps 64-char secrets unchanged', () => {
    expect(getPrivateKeyHexFromSecretKey('b'.repeat(64))).toBe('b'.repeat(64));
  });
});

describe('createCasperMessageBytes', () => {
  it('prefixes with the Casper message header', () => {
    expect(Buffer.from(createCasperMessageBytes('hello')).toString('utf-8')).toBe(
      'Casper Message:\nhello',
    );
  });
});

describe('isTransactionSignedBy', () => {
  const makeTx = (approvals: unknown): Transaction => ({ approvals }) as unknown as Transaction;

  it('returns false when there are no approvals', () => {
    expect(isTransactionSignedBy(makeTx([]), '01aa')).toBe(false);
  });

  it('returns false when approvals is undefined, without throwing', () => {
    expect(isTransactionSignedBy(makeTx(undefined), '01aa')).toBe(false);
  });

  it('returns false when approved by a different key', () => {
    const tx = makeTx([{ signer: { toString: () => '01bb' } }]);
    expect(isTransactionSignedBy(tx, '01aa')).toBe(false);
  });

  it('returns true when approved by the same key, case-insensitively', () => {
    const tx = makeTx([{ signer: { toString: () => '01AABB' } }]);
    expect(isTransactionSignedBy(tx, '01aabb')).toBe(true);
  });
});
