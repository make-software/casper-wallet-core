import { IToken } from '../tokens';
import { CasperNetwork, Network } from '../common';
import { AuctionManagerEntryPointType, IAccount } from './entities';
import { Maybe } from '../../typings';
import { INft } from '../nfts';

export interface ICasperTransactionsRepository {
  sendTokenTransferTransaction(params: ISendTokenTransferTransactionParams): Promise<string>;
  sendNftTransferTransaction(params: ISendNftTransferTransactionParams): Promise<string>;
  sendDelegationTransaction(params: ISendDelegationTransactionParams): Promise<string>;

  signDeploy(deployHash: Uint8Array, publicKeyHex: string, privateKeyBase64: string): Uint8Array;
  signMessage(message: string, publicKeyHex: string, privateKeyBase64: string): Uint8Array;

  validatePublicKey(publicKey: string): boolean;
}

export interface ISendTokenTransferTransactionParams {
  token: IToken;
  network: CasperNetwork;
  toAccount: string;
  activeAccount: IAccount;
  amount: string;
  paymentAmount: string;
  memo: Maybe<string>;
}

export interface ISendNftTransferTransactionParams {
  nft: INft;
  network: CasperNetwork;
  toAccount: string;
  activeAccount: IAccount;
  paymentAmount: string;
}

export interface ISendDelegationTransactionParams {
  entryPoint: AuctionManagerEntryPointType;
  network: Network;
  stake: string;
  activeAccount: IAccount;
  validatorPublicKeyHex: string;
  newValidatorPublicKeyHex?: string;
  paymentAmount: string;
}
