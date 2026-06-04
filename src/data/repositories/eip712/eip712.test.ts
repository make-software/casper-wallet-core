import { PrivateKey, KeyAlgorithm } from 'casper-js-sdk';
import { PermitTypes, buildDomain } from '@casper-ecosystem/casper-eip-712';
import { EIP712Repository } from './index';
import { EIP712Error, isEIP712Error } from '../../../domain';

const DOMAIN = buildDomain('CasperSwap', '1', 'casper', '0x' + '01'.repeat(32));
const MESSAGE = {
  owner: '0x00' + '02'.repeat(32),
  spender: '0x01' + '03'.repeat(32),
  value: 1000n,
  nonce: 0n,
  deadline: 1999999999n,
};
const TYPED_DATA = { domain: DOMAIN, types: PermitTypes, primaryType: 'Permit', message: MESSAGE };
const EXPECTED_DIGEST = '0x545a8088d6365ada6ef282f4d5979c655cd428b4115cbf65f561bcd65767a98c';

describe('EIP712Repository', () => {
  const repo = new EIP712Repository();

  it('computeDigest delegates to the digest util', () => {
    expect(repo.computeDigest(TYPED_DATA).digest).toBe(EXPECTED_DIGEST);
  });

  it('buildDisplayModel returns rows', () => {
    const model = repo.buildDisplayModel(TYPED_DATA);
    expect(model.primaryType).toBe('Permit');
    expect(model.messageRows).toHaveLength(5);
  });

  it('signDigest produces a 02-prefixed secp256k1 signature', () => {
    const key = PrivateKey.fromHex('11'.repeat(32), KeyAlgorithm.SECP256K1);
    const result = repo.signDigest({ privateKey: key, digest: EXPECTED_DIGEST });
    expect(result.signature.startsWith('02')).toBe(true);
    expect(result.digest).toBe(EXPECTED_DIGEST);
  });

  it('signTypedData computes then signs', () => {
    const key = PrivateKey.fromHex('11'.repeat(32), KeyAlgorithm.SECP256K1);
    const result = repo.signTypedData({ typedData: TYPED_DATA, privateKey: key });
    expect(result.digest).toBe(EXPECTED_DIGEST);
  });

  it('preserves an already-typed EIP712Error (pass-through)', () => {
    const broken = { ...TYPED_DATA, primaryType: 'Missing' };
    let caught: unknown;
    try {
      repo.computeDigest(broken);
    } catch (e) {
      caught = e;
    }
    expect(isEIP712Error(caught)).toBe(true);
  });

  it('wraps a non-EIP712 lib failure as EIP712Error with type computeDigest', () => {
    const malformed = { ...TYPED_DATA, message: { ...MESSAGE, owner: '0x1234' } };
    let caught: unknown;
    try {
      repo.computeDigest(malformed);
    } catch (e) {
      caught = e;
    }
    expect(isEIP712Error(caught)).toBe(true);
    expect((caught as EIP712Error).type).toBe('computeDigest');
  });
});
