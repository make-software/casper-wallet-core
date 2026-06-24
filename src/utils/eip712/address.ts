import { Maybe } from '../../typings';

export type Eip712AddressKind = 'account' | 'package' | 'unknown';

export interface IEip712DecodedAddress {
  /** 'account' = 0x00 tag, 'package' = 0x01 tag, 'unknown' = unrecognized. */
  kind: Eip712AddressKind;
  /** 32-byte hash (64 hex, no tag) for account/package; null for unknown. */
  hash: Maybe<string>;
}

const HEX_33_BYTES = /^[\da-f]{66}$/;
const HEX_32_BYTES = /^[\da-f]{64}$/;

const strip0x = (value: string): string => (value.startsWith('0x') ? value.slice(2) : value);

/**
 * Decode an EIP-712 `address` value per CEP-2612/CEP-3009: a 33-byte Casper Key
 * (1-byte tag + 32-byte hash), tag 0x00 = AccountHash, 0x01 = contract package Hash.
 * A bare 32-byte hash is treated leniently as an account hash. Public keys are NOT
 * accepted here — the 0x01 tag means a package, never an ed25519 key.
 */
export const decodeEip712Address = (rawValue: string): IEip712DecodedAddress => {
  const value = strip0x(String(rawValue)).toLowerCase();
  if (HEX_33_BYTES.test(value)) {
    const tag = value.slice(0, 2);
    const hash = value.slice(2);
    if (tag === '00') return { kind: 'account', hash };
    if (tag === '01') return { kind: 'package', hash };
    return { kind: 'unknown', hash: null };
  }
  if (HEX_32_BYTES.test(value)) return { kind: 'account', hash: value };
  return { kind: 'unknown', hash: null };
};
