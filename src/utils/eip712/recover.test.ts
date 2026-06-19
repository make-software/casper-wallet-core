import { secp256k1 } from '@noble/curves/secp256k1';
import { PermitTypes, buildDomain, fromHex } from '@casper-ecosystem/casper-eip-712';
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

  it('re-exports lib helpers for consumers', () => {
    expect(ReexportedPermitTypes).toBeDefined();
    expect(CASPER_DOMAIN_TYPES.map(f => f.name)).toContain('contract_package_hash');
  });
});
