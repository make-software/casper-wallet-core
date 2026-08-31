import type { Deploy, Transaction } from 'casper-js-sdk'; // type-only — the sdk-free gate checks value imports

import type { CasperNetwork } from '../common/common';

export type DexTransactionKind = 'approve' | 'swap' | 'wrap' | 'unwrap';
export type WrapDirection = Extract<DexTransactionKind, 'wrap' | 'unwrap'>;

interface IBuiltDexTransactionBase {
  readonly kind: DexTransactionKind;
  readonly entryPoint: string;
  readonly paymentMotes: string;
}

/**
 * Exactly one of `transaction` / `deploy` is set, selected by the caller's `useTransactionV1`.
 * Narrow with `'transaction' in built` rather than asserting: a signer adapter that writes
 * `deploy ?? transaction!` gets no help from the compiler if a builder ever returns neither.
 */
export type IBuiltDexTransaction = IBuiltDexTransactionBase &
  (
    | { readonly transaction: Transaction; readonly deploy?: never }
    | { readonly deploy: Deploy; readonly transaction?: never }
  );

/**
 * The wrapped-CSPR hash is deliberately *not* here: `SwapRepository`'s synthetic native-CSPR
 * token keys off it too, and two independently-defaulting knobs for one address means every
 * native-CSPR swap fails route validation the moment a consumer sets only one of them. It is a
 * parameter of the setup factories instead.
 */
export interface IDexConfig {
  tradeContractPackageHash?: Record<CasperNetwork, string>; // default TradeContractPackageHash
  gasPriceTolerance?: number; // default 1
  /**
   * Loader for the `proxy_caller.wasm` bytes. Required: the swap, wrap and unwrap builders
   * cannot construct a transaction without it, so a `dexConfig` that omits it produces a
   * repository whose only working method is `buildApprovalTransaction`.
   */
  getProxyWasm: () => Promise<Uint8Array>;
}
