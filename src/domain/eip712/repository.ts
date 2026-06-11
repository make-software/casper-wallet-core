import { PrivateKey } from 'casper-js-sdk';
import {
  IEIP712Digest,
  IEIP712DisplayModel,
  IEIP712SignResult,
  IEIP712SignTypedDataOptions,
  IEIP712TypedData,
} from './entities';

export interface IEIP712SignDigestParams {
  privateKey: PrivateKey;
  digest: string;
}

export interface IEIP712SignTypedDataParams {
  typedData: IEIP712TypedData;
  privateKey: PrivateKey;
  options?: IEIP712SignTypedDataOptions;
}

export interface IEIP712RecoverSignerParams {
  typedData: IEIP712TypedData;
  /** Raw 65-byte recoverable secp256k1 signature (r‖s‖v). Not the wallet's `02`-prefixed format. */
  signature: Uint8Array;
  options?: IEIP712SignTypedDataOptions;
}

export interface IEIP712VerifySignatureParams {
  digest: string;
  /** Raw 65-byte recoverable secp256k1 signature (r‖s‖v). */
  signature: Uint8Array;
  /** 0x-prefixed 20-byte Ethereum-style address (as returned by recoverSigner). */
  expectedAddress: string;
}

/**
 * All methods are synchronous: EIP-712 operations are pure CPU work (validation, hashing, signing)
 * with no network or I/O, unlike the async HTTP-backed repositories in this package.
 */
export interface IEIP712Repository {
  computeDigest(typedData: IEIP712TypedData, options?: IEIP712SignTypedDataOptions): IEIP712Digest;
  buildDisplayModel(typedData: IEIP712TypedData): IEIP712DisplayModel;
  signDigest(params: IEIP712SignDigestParams): IEIP712SignResult;
  signTypedData(params: IEIP712SignTypedDataParams): IEIP712SignResult;
  recoverSigner(params: IEIP712RecoverSignerParams): string;
  verifySignature(params: IEIP712VerifySignatureParams): boolean;
}
