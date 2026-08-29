import type { CasperNetwork } from '../domain/common/common';
import type { IBuiltDexTransaction, IDexContractRepository } from '../domain/dex';
import type { ISwapRepository } from '../domain/swap';
import type { ITokensRepository } from '../domain/tokens';

export interface ITransactionCallbacks {
  onSent?: (transactionHash: string) => void;
  onProcessed?: () => void;
  onError?: (error: unknown) => void;
  onCancelled?: () => void;
}

export interface ISigner {
  readonly publicKey: string;
  /** true when the wallet provider supports signing TransactionV1 ('sign-transactionv1'). */
  readonly supportsTransactionV1: boolean;
  /** Signs and submits; resolves after submission. Status flows through the callbacks. */
  send(built: IBuiltDexTransaction, callbacks: ITransactionCallbacks): Promise<void>;
}

/** Everything the React hooks need from the host app. Each hook takes only the subset it uses. */
export interface ISwapDependencies {
  swapRepository: ISwapRepository;
  dexContractRepository: IDexContractRepository;
  tokensRepository: ITokensRepository;
  network: CasperNetwork;
  /** The signing adapter for the connected account, or `null` when no wallet is connected. */
  signer: ISigner | null;
  /** The connected account's public key, or `null` when no wallet is connected. */
  activePublicKey: string | null;
}

export type TransactionStatus = 'idle' | 'pending' | 'awaiting' | 'success' | 'error';

export interface ApprovalState {
  isRequired: boolean;
  status: TransactionStatus;
  transactionHash?: string;
  error?: string;
}
