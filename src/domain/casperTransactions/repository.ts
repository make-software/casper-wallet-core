import type {
  ISendDelegationParams,
  ISendDexTransactionParams,
  ISendNftTransferParams,
  ISendSignedTransactionParams,
  ISendTokenTransferParams,
  ISignMessageParams,
  ISignTransactionParams,
  ISignTransactionResponse,
} from './entities';
import type { CasperNetwork } from '../common';

export interface ICasperTransactionsRepository {
  /** `getStatus().apiVersion` from the network's node. Apps cache it (redux) and pass it back into send/build calls. */
  getNetworkApiVersion(network: CasperNetwork): Promise<string>;
  /** Drift-corrected ISO timestamp for building transactions (node time vs local−2s, whichever is later). */
  getDateForTransaction(network: CasperNetwork): Promise<string>;
  /** Build + sign + submit. Resolves with the deploy/transaction hash hex. */
  sendTokenTransfer(params: ISendTokenTransferParams): Promise<string>;
  sendNftTransfer(params: ISendNftTransferParams): Promise<string>;
  sendDelegation(params: ISendDelegationParams): Promise<string>;
  /** Submit an externally signed transaction (granular flow — extension Ledger window, WalletConnect). */
  sendSignedTransaction(params: ISendSignedTransactionParams): Promise<string>;
  /** Sign + submit a built DEX artifact (`IBuiltDexTransaction`); the submission backend behind `createDexTransactionSender` (D12). Resolves with the deploy/transaction hash hex. */
  sendDexTransaction(params: ISendDexTransactionParams): Promise<string>;
  /** Raw signature pair for dApp signature requests. Throws AlreadySignedError if this key already approved. */
  signTransaction(params: ISignTransactionParams): Promise<ISignTransactionResponse>;
  signMessage(params: ISignMessageParams): Promise<Uint8Array>;
}
