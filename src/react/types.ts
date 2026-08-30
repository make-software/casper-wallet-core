import type { CasperNetwork } from '../domain/common/common';
import type { IDexContractRepository } from '../domain/dex';
import type { ISwapFlowRunner, IWrapFlowRunner } from '../domain/flows';
import type { ISwapRepository } from '../domain/swap';
import type { ITokensRepository } from '../domain/tokens';

export type { TransactionStatus } from '../domain/flows';

/** Everything the React hooks need from the host app. Each hook takes only the subset it uses. */
export interface ISwapDependencies {
  swapRepository: ISwapRepository;
  dexContractRepository: IDexContractRepository;
  tokensRepository: ITokensRepository;
  network: CasperNetwork;
  /** Runs the swap flow (approve, then swap) for the connected account, or `null` when no wallet is connected. */
  swapFlowRunner: ISwapFlowRunner | null;
  /** Runs the wrap/unwrap flow for the connected account, or `null` when no wallet is connected. */
  wrapFlowRunner: IWrapFlowRunner | null;
  /** The connected account's public key, or `null` when no wallet is connected. */
  activePublicKey: string | null;
}
