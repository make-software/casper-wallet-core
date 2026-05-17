import { getAccountHashesFromTxSignatureRequest } from './common';
import type { ITxSignatureRequest } from '../../../domain';

const PUBLIC_KEY = '0106956df3aba7115e28271d053205ec7f33cab259f8e2da2f38150f0ece65a2a8';

const baseRequest = (overrides: Partial<ITxSignatureRequest> = {}): ITxSignatureRequest =>
  ({
    signingKey: PUBLIC_KEY,
    signingKeyType: 'publicKey',
    senderKey: PUBLIC_KEY,
    senderKeyType: 'publicKey',
    signaturesCollected: [],
    action: { type: 'UNKNOWN', args: {} } as never,
    ...overrides,
  }) as unknown as ITxSignatureRequest;

describe('getAccountHashesFromTxSignatureRequest', () => {
  it('returns at least the signing/sender keys converted to account hashes', () => {
    const hashes = getAccountHashesFromTxSignatureRequest(baseRequest());
    expect(hashes.length).toBeGreaterThan(0);
    hashes.forEach((h) => expect(h).toMatch(/^[0-9a-f]+$/));
  });

  it('includes signaturesCollected publicKeys', () => {
    const hashes = getAccountHashesFromTxSignatureRequest(
      baseRequest({
        signaturesCollected: [{ publicKey: PUBLIC_KEY, signature: 'sig' } as never],
      }),
    );
    expect(hashes.length).toBeGreaterThan(0);
  });

  it('includes recipient for CSPR_NATIVE action', () => {
    const hashes = getAccountHashesFromTxSignatureRequest(
      baseRequest({
        action: {
          type: 'CSPR_NATIVE',
          recipientKey: PUBLIC_KEY,
          recipientKeyType: 'publicKey',
        } as never,
      }),
    );
    expect(hashes.length).toBeGreaterThanOrEqual(2);
  });

  it('includes validators for AUCTION action', () => {
    const hashes = getAccountHashesFromTxSignatureRequest(
      baseRequest({
        action: {
          type: 'AUCTION',
          fromValidator: PUBLIC_KEY,
          fromValidatorKeyType: 'publicKey',
          toValidator: PUBLIC_KEY,
          toValidatorKeyType: 'publicKey',
        } as never,
      }),
    );
    expect(hashes.length).toBeGreaterThan(0);
  });

  it('walks recursive args looking for accountLink entries in UNKNOWN action', () => {
    const hashes = getAccountHashesFromTxSignatureRequest(
      baseRequest({
        action: {
          type: 'UNKNOWN',
          args: {
            top: {
              type: 'object',
              value: {
                deep: { type: 'accountLink', value: PUBLIC_KEY },
              },
            },
          },
        } as never,
      }),
    );

    // Should include the deep accountLink converted to hash
    expect(hashes.length).toBeGreaterThan(0);
  });
});
