import type { Deploy, Transaction } from 'casper-js-sdk'; // type-only — the sdk-free gate checks value imports
import type { CasperNetwork } from '../common';
import type { AuctionManagerEntryPointType } from '../constants';
import type { IBuiltDexTransaction } from '../dex';
import type { IToken } from '../tokens';
import type { INft } from '../nfts';
import type { Maybe } from '../../typings';

/** Raw + algorithm-prefixed signature over a transaction hash or message. */
export interface ISignTransactionResponse {
  signature: Uint8Array;
  signatureWithPrefix: Uint8Array;
}

export interface ISignTransactionOptions {
  /** Legacy Deploy equivalent for signers that cannot sign TransactionV1 (old Ledger apps). */
  fallbackDeploy?: Deploy;
}

/**
 * The only thing an app must supply to sign: either a private-key signer built by
 * `createPrivateKeySigner`, or a hardware signer (`createLedgerSigner` / app adapter).
 */
export interface ICasperSigner {
  readonly publicKeyHex: string;
  /** Raw signature pair over the transaction (dApp signature-request flows). Does not mutate `tx`. */
  signTransaction(tx: Transaction): Promise<ISignTransactionResponse>;
  /** Sign and attach an approval. May resolve with a different object than `tx` when the legacy fallback was signed. */
  getSignedTransaction(tx: Transaction, options?: ISignTransactionOptions): Promise<Transaction>;
  /** Raw signature over `CASPER_MESSAGE_HEADER + message` bytes. */
  signMessage(message: string): Promise<Uint8Array>;
}

export interface ICasperRpcOptions {
  /** casper-js-sdk HttpHandler flavor. Default 'fetch'. Mobile passes 'axios'. */
  handlerType?: 'fetch' | 'axios';
  /**
   * How the CSPR.cloud proxy allowlist referrer is attached.
   * 'fetch-referrer' — HttpHandler.setReferrer (browsers; forbidden to set the header directly).
   * 'referer-header' — literal `Referer` custom header (React Native; fetch ignores the referrer init).
   * Default 'fetch-referrer'.
   */
  referrerMode?: 'fetch-referrer' | 'referer-header';
  authorizationHeader?: string;
}

interface ISendParamsBase {
  network: CasperNetwork;
  /** Node API version string from `getNetworkApiVersion` (e.g. '1.5.8', '2.0.0'). */
  casperNetworkApiVersion: string;
  signer: ICasperSigner;
}

export interface ISendTokenTransferParams extends ISendParamsBase {
  token: IToken;
  toPublicKeyHex: string;
  /** Human-decimal token amount (converted with `token.decimals`). */
  amount: string;
  /** Human-decimal CSPR payment (ignored for native CSPR transfers). */
  paymentAmount: string;
  memo?: Maybe<string>;
}

export interface ISendNftTransferParams extends ISendParamsBase {
  nft: INft;
  toPublicKeyHex: string;
  /** Human-decimal CSPR payment. */
  paymentAmount: string;
}

export interface ISendDelegationParams extends ISendParamsBase {
  entryPoint: AuctionManagerEntryPointType;
  /** Human-decimal CSPR stake. */
  stake: string;
  /** Human-decimal CSPR payment. */
  paymentAmount: string;
  validatorPublicKeyHex: string;
  newValidatorPublicKeyHex?: string;
}

export interface ISignTransactionParams {
  transaction: Transaction;
  signer: ICasperSigner;
}

export interface ISignMessageParams {
  message: string;
  signer: ICasperSigner;
}

export interface ISendSignedTransactionParams {
  transaction: Transaction;
  network: CasperNetwork;
  casperNetworkApiVersion: string;
}

/**
 * Sign + submit one built DEX artifact (swap / wrap / unwrap / approve). The artifact kind was
 * already chosen at build time via `useTransactionV1`, so no fallback pairing applies (D12):
 * a `deploy` submits via `putDeploy`, a `transaction` via `putTransaction`, regardless of the
 * node's API version.
 */
export interface ISendDexTransactionParams {
  built: IBuiltDexTransaction;
  network: CasperNetwork;
  signer: ICasperSigner;
}
