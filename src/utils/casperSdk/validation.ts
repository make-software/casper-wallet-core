import { PublicKey } from 'casper-js-sdk';

const ED25519_KEY_ALGO_PREFIX = '01';
const SECP256K1_KEY_ALGO_PREFIX = '02';
const PUBLIC_KEY_REG_EXP = /^[a-fA-F0-9]*$/;

export const isValidCasperPublicKey = (publicKey: string): boolean => {
  if (!publicKey || !PUBLIC_KEY_REG_EXP.test(publicKey)) {
    return false;
  }

  const prefix = publicKey.slice(0, 2);
  if (
    (prefix === ED25519_KEY_ALGO_PREFIX && publicKey.length !== 66) ||
    (prefix === SECP256K1_KEY_ALGO_PREFIX && publicKey.length !== 68)
  ) {
    return false;
  }

  try {
    PublicKey.fromHex(publicKey).toHex(false);
    return true;
  } catch {
    return false;
  }
};
