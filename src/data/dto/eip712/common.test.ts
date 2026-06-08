import { getAccountHashesFromTypedData } from './common';
import { getAccountHashFromPublicKey } from '../../../utils';

const OWNER = 'a'.repeat(64);
const SPENDER = 'b'.repeat(64);
const SIGNING_PK = '0106956df3aba7115e28271d053205ec7f33cab259f8e2da2f38150f0ece65a2a8';

const typedData = {
  domain: { chain_name: 'casper', contract_package_hash: '0x' + '01'.repeat(32) },
  types: {
    EIP712Domain: [
      { name: 'chain_name', type: 'string' },
      { name: 'contract_package_hash', type: 'bytes32' },
    ],
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
  },
  primaryType: 'Permit',
  message: { owner: OWNER, spender: SPENDER, value: '1000' },
};

describe('getAccountHashesFromTypedData', () => {
  it('collects address-typed values plus the signing-key account hash, deduped', () => {
    const hashes = getAccountHashesFromTypedData(typedData, SIGNING_PK);

    expect(hashes).toContain(OWNER);
    expect(hashes).toContain(SPENDER);
    expect(hashes).toContain(getAccountHashFromPublicKey(SIGNING_PK));
    // non-address fields are ignored: value/contract_package_hash/chain_name absent
    expect(hashes).not.toContain('1000');
    // deduped
    expect(new Set(hashes).size).toBe(hashes.length);
  });

  it('returns only the signing-key hash when there are no address fields', () => {
    const noAddr = {
      ...typedData,
      types: { ...typedData.types, Permit: [{ name: 'value', type: 'uint256' }] },
      message: { value: '1' },
    };
    const hashes = getAccountHashesFromTypedData(noAddr, SIGNING_PK);
    expect(hashes).toEqual([getAccountHashFromPublicKey(SIGNING_PK)]);
  });

  it('ignores an address field whose value is missing/non-string', () => {
    const missingValue = {
      ...typedData,
      types: { ...typedData.types, Permit: [{ name: 'owner', type: 'address' }] },
      message: {}, // owner declared as address but absent
    };
    const hashes = getAccountHashesFromTypedData(missingValue, SIGNING_PK);
    expect(hashes).toEqual([getAccountHashFromPublicKey(SIGNING_PK)]);
    expect(hashes).not.toContain('undefined');
  });
});
