import { IEntity } from '../common';
import { IAccountInfo } from '../accountInfo';
import { Maybe } from '../../typings';

export type DeployStatus =
  | 'success'
  | 'error'
  /**@deprecated*/
  | 'executed'
  | 'pending'
  | 'expired'
  | 'processed';

export type DeployType =
  | 'CSPR_NATIVE'
  | 'CEP18'
  | 'NFT'
  | 'AUCTION'
  | 'CSPR_MARKET'
  | 'ASSOCIATED_KEYS'
  | 'UNKNOWN';

export interface IDeploy extends IEntity {
  readonly deployHash: string;
  readonly entryPoint: Maybe<string>;
  readonly contractName: Maybe<string>;

  readonly type: DeployType;
  readonly executionTypeId: number;
  readonly contractHash: string;
  readonly contractPackageHash: string;

  readonly status: DeployStatus;
  readonly callerPublicKey: string;
  readonly callerKeyType: AccountKeyType;
  readonly callerAccountInfo: Maybe<IAccountInfo>;

  readonly cost: string;
  readonly formattedCost: string;
  readonly fiatCost: string;
  readonly paymentAmount: string;
  readonly formattedPaymentAmount: string;
  readonly fiatPaymentAmount: string;

  readonly timestamp: string;
  readonly errorMessage: Maybe<string>;

  readonly transfersActionsResult: ITransferActionsResult[];
  readonly nftActionsResult: INftActionsResult[];
  readonly cep18ActionsResult: ICep18ActionsResult[];
}

export type AccountKeyType = 'publicKey' | 'accountHash' | 'contractHash' | 'purse';

export interface IAuctionDeploy extends IDeploy {
  readonly contractName: string;
  readonly entryPoint: AuctionEntryPointType;
  readonly fromValidator: Maybe<string>;
  readonly fromValidatorKeyType: AccountKeyType;
  readonly fromValidatorAccountInfo: Maybe<IAccountInfo>;
  readonly toValidator: Maybe<string>;
  readonly toValidatorKeyType: AccountKeyType;
  readonly toValidatorAccountInfo: Maybe<IAccountInfo>;

  readonly decimals: number;
  readonly symbol: string;
  readonly amount: string;
  readonly decimalAmount: string;
  readonly formattedDecimalAmount: string;
  readonly fiatAmount: string;
}

export interface IAssociatedKeysDeploy extends IDeploy {
  readonly contractName: string;
}

export interface ICasperMarketDeploy extends IDeploy {
  readonly entryPoint: CSPRMarketEntryPointType;
  readonly contractName: string;
  readonly amountOfNFTs: Maybe<number>;

  readonly offererHash: Maybe<string>;
  readonly offererHashType: Maybe<AccountKeyType>;
  readonly offererAccountInfo: Maybe<IAccountInfo>;
  readonly collectionHash: string;
  readonly nftTokenIds: string[];
  readonly iconUrl: Maybe<string>;

  readonly amount: string;
  readonly decimalAmount: string;
  readonly formattedDecimalAmount: string;
  readonly fiatAmount: string;
}

export interface INftDeploy extends IDeploy {
  readonly contractName: string;
  readonly entryPoint: NFTEntryPointType;
  readonly recipientKey: string;
  readonly recipientKeyType: AccountKeyType;
  readonly isReceive: boolean;
  readonly recipientAccountInfo: Maybe<IAccountInfo>;
  readonly amountOfNFTs: Maybe<number>;
  readonly nftTokenIds: string[];
  readonly iconUrl: Maybe<string>;
  readonly collectionHash: string;
}

export interface INativeCsprDeploy extends IDeploy {
  readonly recipientKey: string;
  readonly recipientKeyType: AccountKeyType;
  readonly recipientAccountInfo: Maybe<IAccountInfo>;
  readonly isReceive: boolean;

  readonly decimals: number;
  readonly symbol: string;
  readonly amount: string;
  readonly decimalAmount: string;
  readonly formattedDecimalAmount: string;
  readonly fiatAmount: string;
}

export interface ICep18Deploy extends INativeCsprDeploy {
  readonly entryPoint: CEP18EntryPointType;
  readonly contractName: string;
  readonly iconUrl: Maybe<string>;
}

export type ICep18ActionsResult = Pick<
  ICep18Deploy,
  | 'timestamp'
  | 'callerPublicKey'
  | 'callerKeyType'
  | 'callerAccountInfo'
  | 'contractPackageHash'
  | 'entryPoint'
  | 'symbol'
  | 'contractName'
  | 'iconUrl'
  | 'recipientKey'
  | 'recipientKeyType'
  | 'recipientAccountInfo'
  | 'isReceive'
  | 'decimals'
  | 'amount'
  | 'decimalAmount'
  | 'formattedDecimalAmount'
> &
  IEntity;

export type INftActionsResult = Pick<
  INftDeploy,
  | 'nftTokenIds'
  | 'recipientKey'
  | 'recipientKeyType'
  | 'recipientAccountInfo'
  | 'isReceive'
  | 'callerPublicKey'
  | 'callerKeyType'
  | 'callerAccountInfo'
  | 'timestamp'
  | 'contractName'
  | 'entryPoint'
  | 'iconUrl'
> &
  IEntity;

export type ITransferActionsResult = Pick<
  INativeCsprDeploy,
  | 'recipientKey'
  | 'recipientKeyType'
  | 'recipientAccountInfo'
  | 'callerPublicKey'
  | 'callerKeyType'
  | 'callerAccountInfo'
  | 'isReceive'
  | 'timestamp'
  | 'formattedDecimalAmount'
  | 'decimalAmount'
  | 'amount'
  | 'fiatAmount'
> &
  IEntity;

export type NamedEntryPointType =
  | CSPRMarketEntryPointType
  | CEP18EntryPointType
  | NFTEntryPointType
  | AuctionEntryPointType;

export type CSPRMarketEntryPointType =
  | 'delist_token'
  | 'list_token'
  | 'accept_offer'
  | 'cancel_offer'
  | 'make_offer';

export type CEP18EntryPointType = 'approve' | 'mint' | 'burn' | 'transfer';

export type NFTEntryPointType = CEP18EntryPointType | 'update_token_meta' | 'set_approval_for_all';

export type AuctionEntryPointType =
  | 'add_bid'
  | 'withdraw_bid'
  | 'activate_bid'
  | 'delegate'
  | 'undelegate'
  | 'redelegate';
