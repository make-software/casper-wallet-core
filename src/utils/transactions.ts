// type-only: a value import would pull the sdk into this module's import graph
import type { Transaction } from 'casper-js-sdk';
import { CASPER_MESSAGE_HEADER } from '../domain/constants';
import { isKeysEqual } from './common';

/** Legacy accounts may store 64-byte (priv+pub) material; the private scalar is the first 32 bytes. */
export const getPrivateKeyHexFromSecretKey = (secretKeyHex: string): string =>
  secretKeyHex.substring(0, 64);

/**
 * Prepends the Casper message header and converts to bytes.
 * Buffer (not TextEncoder) on purpose — matches both apps and legacy runtimes.
 */
export const createCasperMessageBytes = (message: string): Uint8Array =>
  Uint8Array.from(Buffer.from(`${CASPER_MESSAGE_HEADER}${message}`));

export const isTransactionSignedBy = (tx: Transaction, publicKeyHex: string): boolean =>
  tx.approvals?.some(approval => isKeysEqual(approval.signer.toString(), publicKeyHex)) ?? false;
