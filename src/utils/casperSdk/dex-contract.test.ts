import { CLValue, Key, PublicKey } from 'casper-js-sdk';

import { keysToHex } from './dex-contract';

import { TradeContractPackageHash } from '../../domain';

const PUBLIC_KEY = '0106956df3aba7115e28271d053205ec7f33cab259f8e2da2f38150f0ece65a2a8';

const accountKey = () =>
  CLValue.newCLKey(Key.newKey(PublicKey.fromHex(PUBLIC_KEY).accountHash().toPrefixedString()));
const operatorKey = () => CLValue.newCLKey(Key.newKey(TradeContractPackageHash.mainnet));

/**
 * Fixed vectors, not a re-run of the implementation. The digest was cross-checked against
 * Python's `hashlib.blake2b(a + b, digest_size=32)` — a separate blake2b implementation — so a
 * change to `dkLen` or to the concatenation order moves the left side only and fails.
 *
 * The inputs are this repo's own serialization, so these pin the derivation against drift; they
 * do not independently confirm that the deployed CEP-18 contracts key `allowances` this way.
 */
const ACCOUNT_KEY_BYTES = '000379ee3245b15cb03dafa417451b07735c032953be6301a0bf253b68309eaacc';
const OPERATOR_KEY_BYTES = '011dbac65585475fec53e5b1f9110923c8d232921702097e83105b36751d682186';
const ALLOWANCES_DICT_KEY = 'd3cf5c22d374ac6ec3e20c825ad6f38b47f15ba4db675ab3ab598d0fa6c03782';

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');

describe('keysToHex', () => {
  it('serializes an account key and a contract-package key to the expected bytes', () => {
    expect(toHex(accountKey().bytes())).toBe(ACCOUNT_KEY_BYTES);
    expect(toHex(operatorKey().bytes())).toBe(OPERATOR_KEY_BYTES);
  });

  it('derives the allowances dictionary key as blake2b-256 over owner ++ spender', () => {
    expect(keysToHex(accountKey(), operatorKey())).toBe(ALLOWANCES_DICT_KEY);
  });

  it('is order-sensitive: owner ++ spender is not spender ++ owner', () => {
    expect(keysToHex(operatorKey(), accountKey())).not.toBe(ALLOWANCES_DICT_KEY);
  });

  it('returns a 32-byte digest', () => {
    expect(keysToHex(accountKey(), operatorKey())).toHaveLength(64);
  });
});
