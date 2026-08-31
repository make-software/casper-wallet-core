import type { IBuiltDexTransaction } from './entities';

import type { CasperNetwork } from '../common/common';
import type { IDexTokenWithAmount, SwapQuoteType } from '../swap';

export interface IDexContractRepository {
  getAllowance(params: {
    network: CasperNetwork;
    contractPackageHash: string;
    publicKey: string;
    operatorContractPackageHash?: string;
  }): Promise<string>;
  checkApprovalRequired(params: {
    network: CasperNetwork;
    contractPackageHash: string;
    publicKey: string;
    requiredAmount: string;
  }): Promise<boolean>;
  getLatestBlockTime(params: { network: CasperNetwork }): Promise<number>;
  buildApprovalTransaction(params: IBuildApprovalParams): Promise<IBuiltDexTransaction>;
  /**
   * Sets the trade contract's allowance for this token back to zero.
   *
   * A swap approves a bounded amount derived from the trade, but the unspent remainder stays
   * granted after the swap settles — and after one that reverted. The grant is made to a
   * *contract package*, whose owner can upgrade the implementation behind it, so a surface that
   * wants to leave nothing standing should offer this. Nothing revokes automatically: it is a
   * third signature, confirmation and payment, and it undoes the saving of a still-sufficient
   * allowance on the user's next swap. Read the standing amount with {@link getAllowance}.
   */
  buildRevokeApprovalTransaction(params: IBuildRevokeApprovalParams): Promise<IBuiltDexTransaction>;
  buildSwapTransaction(params: IBuildSwapParams): Promise<IBuiltDexTransaction>;
  buildWrapTransaction(params: IBuildWrapParams): Promise<IBuiltDexTransaction>;
  buildUnwrapTransaction(params: IBuildUnwrapParams): Promise<IBuiltDexTransaction>;
}

export interface IBuildWrapParams {
  network: CasperNetwork;
  publicKey: string;
  motesAmount: string; // native CSPR motes to wrap; minted 1:1 as WCSPR
  useTransactionV1: boolean;
}

export interface IBuildUnwrapParams {
  network: CasperNetwork;
  publicKey: string;
  rawAmount: string; // WCSPR units to burn (1:1 with motes at 9 decimals)
  useTransactionV1: boolean;
}

export interface IBuildApprovalParams {
  network: CasperNetwork;
  publicKey: string;
  contractPackageHash: string;
  amount: string; // raw motes/base units to approve
  useTransactionV1: boolean;
}

export type IBuildRevokeApprovalParams = Omit<IBuildApprovalParams, 'amount'>;

export interface IBuildSwapParams {
  network: CasperNetwork;
  publicKey: string;
  firstToken: IDexTokenWithAmount;
  secondToken: IDexTokenWithAmount;
  path: string[];
  quoteType: SwapQuoteType;
  slippage: number; // percent
  deadline: number; // minutes
  useTransactionV1: boolean;
}
