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

export interface IKeyValueStorage {
  get(key: string): string | null | Promise<string | null>;
  set(key: string, value: string): void | Promise<void>;
}

/** Storage keys for the persisted contract settings — named by the host app, not this library. */
export interface IContractSettingsStorageKeys {
  slippage: string;
  deadline: string;
}

export interface IRepositoriesContextValue {
  swapRepository: ISwapRepository;
  dexContractRepository: IDexContractRepository;
  tokensRepository: ITokensRepository;
  network: CasperNetwork;
  signer: ISigner | null;
  activePublicKey: string | null;
}

export interface IContractSettings {
  slippage: number; // percent
  deadline: number; // minutes
  updateSlippage: (slippage: number) => void; // clamped via clampSlippageValue
  updateDeadline: (deadline: number) => void; // clamped via clampDeadlineValue
}

export type TransactionStatus = 'idle' | 'pending' | 'awaiting' | 'success' | 'error';

export interface ApprovalState {
  isRequired: boolean;
  status: TransactionStatus;
  transactionHash?: string;
  error?: string;
}
