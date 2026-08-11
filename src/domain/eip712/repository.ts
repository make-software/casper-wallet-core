// Type-only: this contract is reachable from the `domain` barrel, which sits on the wallet
// startup path. A value import here would link the whole `casper-js-sdk` bundle.
import type { PrivateKey } from 'casper-js-sdk';
import {
  IEIP712Digest,
  IEIP712DisplayModel,
  IEIP712SignatureRequest,
  IEIP712SignResult,
  IEIP712SignTypedDataOptions,
  IEIP712TypedData,
} from './entities';
import { CasperNetwork } from '../common';

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

export interface IPrepareEIP712SignatureRequestParams {
  typedData: IEIP712TypedData;
  signingPublicKeyHex: string;
  /** Fallback network when `domain.chain_name` cannot be mapped. */
  network?: CasperNetwork;
  options?: IEIP712SignTypedDataOptions;
  /** Default `true`. */
  withProxyHeader?: boolean;
}

/**
 * `prepareSignatureRequest` is asynchronous: it enriches the typed data with account info and
 * contract-package data over HTTP. The remaining methods are synchronous — EIP-712 validation,
 * hashing and signing are pure CPU work with no I/O.
 */
export interface IEIP712Repository {
  computeDigest(typedData: IEIP712TypedData, options?: IEIP712SignTypedDataOptions): IEIP712Digest;
  buildDisplayModel(typedData: IEIP712TypedData): IEIP712DisplayModel;
  signDigest(params: IEIP712SignDigestParams): IEIP712SignResult;
  signTypedData(params: IEIP712SignTypedDataParams): IEIP712SignResult;
  recoverSigner(params: IEIP712RecoverSignerParams): string;
  verifySignature(params: IEIP712VerifySignatureParams): boolean;
  prepareSignatureRequest(
    params: IPrepareEIP712SignatureRequestParams,
  ): Promise<IEIP712SignatureRequest>;
}
