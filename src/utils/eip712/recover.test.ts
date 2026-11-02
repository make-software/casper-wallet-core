import { secp256k1 } from '@noble/curves/secp256k1';
import {
  PermitTypes,
  buildDomain,
  fromHex,
  keccak256,
  toHex,
} from '@casper-ecosystem/casper-eip-712';
import { SignTypedDataErrorCodes } from '../../domain';
import { buildPermit2TypedData } from '../../__test-utils__/permit2';
import { computeTypedDataEIP712Digest } from './digest';
import {
  CASPER_DOMAIN_TYPES,
  PermitTypes as ReexportedPermitTypes,
  recoverTypedDataEIP712SignerAddress,
  verifyTypedDataEIP712Signature,
} from './recover';

const DOMAIN = buildDomain('CasperSwap', '1', 'casper', '0x' + '01'.repeat(32));
const MESSAGE = {
  owner: '0x00' + '02'.repeat(32),
  spender: '0x01' + '03'.repeat(32),
  value: 1000n,
  nonce: 0n,
  deadline: 1999999999n,
};
const TYPED_DATA = { domain: DOMAIN, types: PermitTypes, primaryType: 'Permit', message: MESSAGE };

function recoverableSig(): Uint8Array {
  const { digest } = computeTypedDataEIP712Digest(TYPED_DATA);
  const sig = secp256k1.sign(fromHex(digest), fromHex('11'.repeat(32)));
  const out = new Uint8Array(65);
  out.set(sig.toCompactRawBytes(), 0);
  out[64] = sig.recovery;
  return out;
}

describe('recover/verify', () => {
  it('recovers the expected Ethereum-style address', () => {
    const address = recoverTypedDataEIP712SignerAddress({
      typedData: TYPED_DATA,
      signature: recoverableSig(),
    });
    expect(address).toBe('0x19e7e376e7c213b7e7e7e46cc70a5dd086daff2a');
  });

  it('verifies a signature against the recovered address', () => {
    const sig = recoverableSig();
    const { digest } = computeTypedDataEIP712Digest(TYPED_DATA);
    const address = recoverTypedDataEIP712SignerAddress({ typedData: TYPED_DATA, signature: sig });
    expect(
      verifyTypedDataEIP712Signature({ digest, signature: sig, expectedAddress: address }),
    ).toBe(true);
  });

  it('recovers the same address for a decimal-string and a bigint value', () => {
    const sig = recoverableSig();
    const asString = { ...TYPED_DATA, message: { ...TYPED_DATA.message, value: '1000' } };
    expect(recoverTypedDataEIP712SignerAddress({ typedData: asString, signature: sig })).toBe(
      recoverTypedDataEIP712SignerAddress({ typedData: TYPED_DATA, signature: sig }),
    );
  });

  it.each([
    ['a value the digest rejects', { ...TYPED_DATA, message: { ...MESSAGE, value: '01e3' } }],
    ['a negative decimal string', { ...TYPED_DATA, message: { ...MESSAGE, value: '-1' } }],
    [
      'a domain without chain_name',
      {
        ...TYPED_DATA,
        domain: Object.fromEntries(Object.entries(DOMAIN).filter(([k]) => k !== 'chain_name')),
      },
    ],
    ['an unknown primaryType', { ...TYPED_DATA, primaryType: 'Missing' }],
  ])('rejects %s with INVALID_PARAMS instead of recovering', (_, typedData) =>
    expect(() =>
      recoverTypedDataEIP712SignerAddress({ typedData, signature: recoverableSig() }),
    ).toThrow(expect.objectContaining({ errorCode: SignTypedDataErrorCodes.INVALID_PARAMS })),
  );

  it('re-exports lib helpers for consumers', () => {
    expect(ReexportedPermitTypes).toBeDefined();
    expect(CASPER_DOMAIN_TYPES.map(f => f.name)).toContain('contract_package_hash');
  });

  describe('nested typed data', () => {
    it('recovers the signer of a PermitBatch signature', () => {
      const typedData = buildPermit2TypedData('PermitBatch');
      const { digest } = computeTypedDataEIP712Digest(typedData);
      const key = fromHex('11'.repeat(32));
      const sig = secp256k1.sign(fromHex(digest), key);
      const signature = new Uint8Array(65);
      signature.set(sig.toCompactRawBytes(), 0);
      signature[64] = sig.recovery;
      const expected = toHex(keccak256(secp256k1.getPublicKey(key, false).slice(1)).slice(12));
      expect(recoverTypedDataEIP712SignerAddress({ typedData, signature })).toBe(expected);
    });

    it('rejects a nested missing field with INVALID_PARAMS', () => {
      const base = buildPermit2TypedData('PermitBatch');
      const [first, ...rest] = (base.message as { details: Record<string, unknown>[] }).details;
      const broken = { ...first };
      delete broken.amount;
      const typedData = { ...base, message: { ...base.message, details: [broken, ...rest] } };
      expect(() =>
        recoverTypedDataEIP712SignerAddress({ typedData, signature: new Uint8Array(65) }),
      ).toThrow(expect.objectContaining({ errorCode: SignTypedDataErrorCodes.INVALID_PARAMS }));
    });
  });
});
