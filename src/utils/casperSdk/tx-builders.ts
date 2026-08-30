import {
  AuctionManagerEntryPoint,
  Deploy,
  makeAuctionManagerDeploy,
  makeAuctionManagerTransaction,
  makeCep18TransferDeploy,
  makeCep18TransferTransaction,
  makeCsprTransferDeploy,
  makeCsprTransferTransaction,
  Transaction,
} from 'casper-js-sdk';
// Type-only: `makeAuctionManager{Deploy,Transaction}` type their `chainName` param as the SDK
// enum, unlike the other three builders (which accept a plain string) — see the cast below.
import type { CasperNetworkName } from 'casper-js-sdk';
import { AuctionManagerEntryPointType, CasperSdkNetworkName } from '../../domain/constants';
import { CasperNetwork } from '../../domain/common';
import { NftStandard } from '../../domain/nfts';
import {
  makeNftTransferDeploy,
  makeNftTransferTransaction,
  NftStandardToSdkStandardMap,
} from './cep-nft-transfer';

/** Lives here, not in `src/domain/constants` — it value-imports the SDK enum (D13). */
export const AuctionManagerEntryPointMap: Record<
  AuctionManagerEntryPointType,
  | AuctionManagerEntryPoint.delegate
  | AuctionManagerEntryPoint.redelegate
  | AuctionManagerEntryPoint.undelegate
> = {
  DELEGATE: AuctionManagerEntryPoint.delegate,
  UNDELEGATE: AuctionManagerEntryPoint.undelegate,
  REDELEGATE: AuctionManagerEntryPoint.redelegate,
};

export interface IBuiltCasperTransaction {
  transaction: Transaction;
  /** Legacy Deploy for signers that cannot sign TransactionV1 (old Ledger apps). */
  fallbackDeploy: Deploy;
}

export interface IBuildCsprTransferParams {
  network: CasperNetwork;
  senderPublicKeyHex: string;
  recipientPublicKeyHex: string;
  /** Motes. */
  transferAmountMotes: string;
  memo?: string;
  timestamp?: string;
  gasPrice?: number;
}

export const buildCsprTransferTransactions = (
  {
    network,
    senderPublicKeyHex,
    recipientPublicKeyHex,
    transferAmountMotes,
    memo,
    timestamp,
    gasPrice = 1,
  }: IBuildCsprTransferParams,
  casperNetworkApiVersion: string,
): IBuiltCasperTransaction => {
  const chainName = CasperSdkNetworkName[network];

  const transaction = makeCsprTransferTransaction({
    chainName,
    memo,
    recipientPublicKeyHex,
    senderPublicKeyHex,
    transferAmount: transferAmountMotes,
    timestamp,
    casperNetworkApiVersion,
    gasPrice,
  });

  // required for old Ledger apps
  const fallbackDeploy = makeCsprTransferDeploy({
    chainName,
    memo,
    recipientPublicKeyHex,
    senderPublicKeyHex,
    transferAmount: transferAmountMotes,
    timestamp,
  });

  return { transaction, fallbackDeploy };
};

export interface IBuildCep18TransferParams {
  network: CasperNetwork;
  contractPackageHash: string;
  senderPublicKeyHex: string;
  recipientPublicKeyHex: string;
  /** Motes (token's own decimals). */
  transferAmountMotes: string;
  /** Motes (CSPR). */
  paymentAmountMotes: string;
  timestamp?: string;
  gasPrice?: number;
}

export const buildCep18TransferTransactions = (
  {
    network,
    contractPackageHash,
    senderPublicKeyHex,
    recipientPublicKeyHex,
    transferAmountMotes,
    paymentAmountMotes,
    timestamp,
    gasPrice = 1,
  }: IBuildCep18TransferParams,
  casperNetworkApiVersion: string,
): IBuiltCasperTransaction => {
  const chainName = CasperSdkNetworkName[network];

  const transaction = makeCep18TransferTransaction({
    chainName,
    contractPackageHash,
    paymentAmount: paymentAmountMotes,
    recipientPublicKeyHex,
    senderPublicKeyHex,
    transferAmount: transferAmountMotes,
    timestamp,
    casperNetworkApiVersion,
    gasPrice,
  });

  // required for old Ledger apps
  const fallbackDeploy = makeCep18TransferDeploy({
    chainName,
    contractPackageHash,
    paymentAmount: paymentAmountMotes,
    recipientPublicKeyHex,
    senderPublicKeyHex,
    transferAmount: transferAmountMotes,
    timestamp,
  });

  return { transaction, fallbackDeploy };
};

export interface IBuildNftTransferParams {
  network: CasperNetwork;
  contractPackageHash: string;
  nftStandard: NftStandard;
  senderPublicKeyHex: string;
  recipientPublicKeyHex: string;
  /** Motes (CSPR). */
  paymentAmountMotes: string;
  tokenId?: string;
  tokenHash?: string;
  timestamp?: string;
  gasPrice?: number;
}

export const buildNftTransferTransactions = (
  {
    network,
    contractPackageHash,
    nftStandard,
    senderPublicKeyHex,
    recipientPublicKeyHex,
    paymentAmountMotes,
    tokenId,
    tokenHash,
    timestamp,
    gasPrice = 1,
  }: IBuildNftTransferParams,
  casperNetworkApiVersion: string,
): IBuiltCasperTransaction => {
  const chainName = CasperSdkNetworkName[network];
  const sdkStandard = NftStandardToSdkStandardMap[nftStandard];

  const transaction = makeNftTransferTransaction({
    chainName,
    contractPackageHash,
    nftStandard: sdkStandard,
    paymentAmount: paymentAmountMotes,
    recipientPublicKeyHex,
    senderPublicKeyHex,
    tokenId,
    tokenHash,
    timestamp,
    casperNetworkApiVersion,
    gasPrice,
  });

  // required for old Ledger apps (D11: direct deploy build == legacy '1.5.8' hack)
  const fallbackDeploy = makeNftTransferDeploy({
    chainName,
    contractPackageHash,
    nftStandard: sdkStandard,
    paymentAmount: paymentAmountMotes,
    recipientPublicKeyHex,
    senderPublicKeyHex,
    tokenId,
    tokenHash,
    timestamp,
    gasPrice,
  });

  return { transaction, fallbackDeploy };
};

export interface IBuildAuctionManagerParams {
  network: CasperNetwork;
  entryPoint: AuctionManagerEntryPointType;
  delegatorPublicKeyHex: string;
  validatorPublicKeyHex: string;
  newValidatorPublicKeyHex?: string;
  /** Motes (CSPR). */
  amountMotes: string;
  /** Motes (CSPR). */
  paymentAmountMotes: string;
  timestamp?: string;
  gasPrice?: number;
}

export const buildAuctionManagerTransactions = (
  {
    network,
    entryPoint,
    delegatorPublicKeyHex,
    validatorPublicKeyHex,
    newValidatorPublicKeyHex,
    amountMotes,
    paymentAmountMotes,
    timestamp,
    gasPrice = 1,
  }: IBuildAuctionManagerParams,
  casperNetworkApiVersion: string,
): IBuiltCasperTransaction => {
  const chainName = CasperSdkNetworkName[network];
  const contractEntryPoint = AuctionManagerEntryPointMap[entryPoint];

  const transaction = makeAuctionManagerTransaction({
    amount: amountMotes,
    paymentAmount: paymentAmountMotes,
    chainName: chainName as CasperNetworkName,
    contractEntryPoint,
    delegatorPublicKeyHex,
    newValidatorPublicKeyHex,
    validatorPublicKeyHex,
    timestamp,
    casperNetworkApiVersion,
    gasPrice,
  });

  // required for old Ledger apps
  const fallbackDeploy = makeAuctionManagerDeploy({
    amount: amountMotes,
    paymentAmount: paymentAmountMotes,
    chainName: chainName as CasperNetworkName,
    contractEntryPoint,
    delegatorPublicKeyHex,
    newValidatorPublicKeyHex,
    validatorPublicKeyHex,
    timestamp,
  });

  return { transaction, fallbackDeploy };
};
