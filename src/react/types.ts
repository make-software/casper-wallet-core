import type { CasperNetwork } from '../domain/common/common';
import type { IDexContractRepository, IDexTransactionSender } from '../domain/dex';
import type { ISwapRepository } from '../domain/swap';
import type { ITokensRepository } from '../domain/tokens';

export type { IDexTransactionSender, ITransactionCallbacks } from '../domain/dex';

/** Everything the React hooks need from the host app. Each hook takes only the subset it uses. */
export interface ISwapDependencies {
  swapRepository: ISwapRepository;
  dexContractRepository: IDexContractRepository;
  tokensRepository: ITokensRepository;
  network: CasperNetwork;
  /** The dex transaction sender for the connected account, or `null` when no wallet is connected. Built via `createDexTransactionSender`. */
  signer: IDexTransactionSender | null;
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
