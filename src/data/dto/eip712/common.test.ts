import {
  getAccountHashesFromTypedDataEIP712,
  getPackageHashesFromTypedDataEIP712,
  stripHexPrefix,
} from './common';
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

describe('getAccountHashesFromTypedDataEIP712', () => {
  it('collects address-typed values plus the signing-key account hash, deduped', () => {
    const hashes = getAccountHashesFromTypedDataEIP712(typedData, SIGNING_PK);

    expect(hashes).toContain(OWNER);
    expect(hashes).toContain(SPENDER);
    expect(hashes).toContain(getAccountHashFromPublicKey(SIGNING_PK));
    // non-address fields are ignored: value/contract_package_hash/chain_name absent
    expect(hashes).not.toContain('1000');
  });

  it('deduplicates a hash that appears in more than one address field', () => {
    // spender repeats owner's value → the resolved hash must appear exactly once
    const dupData = { ...typedData, message: { ...typedData.message, spender: OWNER } };
    const hashes = getAccountHashesFromTypedDataEIP712(dupData, SIGNING_PK);
    expect(hashes.filter(h => h === OWNER)).toHaveLength(1);
  });

  it('returns only the signing-key hash when there are no address fields', () => {
    const noAddr = {
      ...typedData,
      types: { ...typedData.types, Permit: [{ name: 'value', type: 'uint256' }] },
      message: { value: '1' },
    };
    const hashes = getAccountHashesFromTypedDataEIP712(noAddr, SIGNING_PK);
    expect(hashes).toEqual([getAccountHashFromPublicKey(SIGNING_PK)]);
  });

  it('ignores an address field whose value is missing/non-string', () => {
    const missingValue = {
      ...typedData,
      types: { ...typedData.types, Permit: [{ name: 'owner', type: 'address' }] },
      message: {}, // owner declared as address but absent
    };
    const hashes = getAccountHashesFromTypedDataEIP712(missingValue, SIGNING_PK);
    expect(hashes).toEqual([getAccountHashFromPublicKey(SIGNING_PK)]);
    expect(hashes).not.toContain('undefined');
  });
});

describe('stripHexPrefix', () => {
  it('removes a leading 0x only', () => {
    expect(stripHexPrefix('0xabc')).toBe('abc');
    expect(stripHexPrefix('abc')).toBe('abc');
  });
});

const ACC = 'a'.repeat(64);
const PKG = 'b'.repeat(64);

describe('getAccountHashesFromTypedDataEIP712 — account-tagged only + signer', () => {
  const typedDataTagged = {
    domain: {},
    types: {
      Transfer: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
      ],
    },
    primaryType: 'Transfer',
    message: { from: '00' + ACC, to: '01' + PKG, value: '1' },
  };

  it('collects only account-tagged addresses plus the signer hash', () => {
    const hashes = getAccountHashesFromTypedDataEIP712(typedDataTagged, SIGNING_PK);
    expect(hashes).toContain(ACC); // account-tagged `from`
    expect(hashes).not.toContain(PKG); // package-tagged `to` excluded
    expect(hashes.length).toBeGreaterThanOrEqual(2); // ACC + signer
  });

  it('includes the signer account hash derived from the signing public key', () => {
    const hashes = getAccountHashesFromTypedDataEIP712(typedDataTagged, SIGNING_PK);
    expect(hashes).toContain(getAccountHashFromPublicKey(SIGNING_PK));
  });
});

describe('getPackageHashesFromTypedDataEIP712', () => {
  it('collects the domain package hash and package-tagged message addresses', () => {
    const typedDataPkg = {
      domain: { contract_package_hash: '0x' + PKG },
      types: {
        Transfer: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
        ],
      },
      primaryType: 'Transfer',
      message: { from: '00' + ACC, to: '01' + 'c'.repeat(64) },
    };
    const hashes = getPackageHashesFromTypedDataEIP712(typedDataPkg);
    expect(hashes).toContain(PKG); // domain (0x stripped)
    expect(hashes).toContain('c'.repeat(64)); // package-tagged `to`
    expect(hashes).not.toContain(ACC); // account `from` excluded
  });
});
