import type { IBuiltDexTransaction } from './entities';

import type { CasperNetwork } from '../common/common';
import type { IDexTokenWithAmount, SwapQuoteType } from '../swap';

export interface IDexContractRepository {
  getTokenBalance(params: {
    network: CasperNetwork;
    contractPackageHash: string;
    publicKey: string;
  }): Promise<string>;
  getCsprBalance(params: { network: CasperNetwork; publicKey: string }): Promise<string>;
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
