import { IEntity } from '../common';
import {
  AccountKeyType,
  DeployType,
  IAssociatedKeysDeploy,
  IAuctionDeploy,
  ICasperMarketDeploy,
  ICep18Deploy,
  INativeCsprDeploy,
  INftDeploy,
} from '../deploys';
import { Maybe } from '../../typings';
import { IAccountInfo } from '../accountInfo';

export interface ITxSignatureRequest extends IEntity {
  readonly signingKey: string;
  readonly signingKeyType: AccountKeyType;
  readonly signingAccountInfo: Maybe<IAccountInfo>;

  readonly action: ITxSignatureRequestActionUnion;

  readonly senderKey: string;
  readonly senderKeyType: AccountKeyType;
  readonly senderAccountInfo: Maybe<IAccountInfo>;

  readonly chainName: string;
  readonly memo: Maybe<string>;
  readonly txHash: string;
  readonly expires: string;

  readonly paymentAmount: string;
  readonly formattedPaymentAmount: string;
  readonly fiatPaymentAmount: string;

  // PK
  readonly signaturesCollected: ISignaturesCollectedInfo[];

  readonly rawJson: string;
}

export interface ISignaturesCollectedInfo {
  readonly publicKey: string;
  readonly weight: Maybe<number>;
  readonly accountInfo: Maybe<IAccountInfo>;
}

export type ITxSignatureRequestActionType = DeployType | 'WASM' | 'WASM_PROXY';

export type ITxSignatureRequestActionUnion =
  | ITxSignatureRequestNativeCsprAction
  | ITxSignatureRequestCep18Action
  | ITxSignatureRequestNFTAction
  | ITxSignatureRequestCasperMarketAction
  | ITxSignatureRequestAssociatedKeysAction
  | ITxSignatureRequestAuctionAction
  | ITxSignatureRequestUnknownContractAction
  | ITxSignatureRequestWasmAction
  | ITxSignatureRequestWasmProxyAction;

export interface ITxSignatureRequestAction {
  readonly type: ITxSignatureRequestActionType;
}

export interface ITxSignatureRequestNativeCsprAction
  extends ITxSignatureRequestAction,
    Pick<
      INativeCsprDeploy,
      | 'recipientKey'
      | 'recipientKeyType'
      | 'recipientAccountInfo'
      | 'decimals'
      | 'symbol'
      | 'amount'
      | 'decimalAmount'
      | 'formattedDecimalAmount'
      | 'fiatAmount'
    > {
  readonly type: 'CSPR_NATIVE';
}

export interface ITxSignatureRequestCep18Action
  extends ITxSignatureRequestAction,
    Pick<
      ICep18Deploy,
      | 'recipientKey'
      | 'recipientKeyType'
      | 'recipientAccountInfo'
      | 'decimals'
      | 'symbol'
      | 'amount'
      | 'decimalAmount'
      | 'formattedDecimalAmount'
      | 'fiatAmount'
      | 'contractName'
      | 'iconUrl'
    > {
  readonly entryPoint: string;
  readonly type: 'CEP18';
  readonly contractPackageHash: Maybe<string>;
  readonly contractHash: Maybe<string>;
  readonly contractLink: Maybe<string>;
}

export interface ITxSignatureRequestNFTAction
  extends ITxSignatureRequestAction,
    Pick<
      INftDeploy,
      | 'contractName'
      | 'recipientKey'
      | 'recipientKeyType'
      | 'recipientAccountInfo'
      | 'amountOfNFTs'
      | 'nftTokenIds'
      | 'collectionHash'
      | 'iconUrl'
    > {
  readonly entryPoint: string;
  readonly type: 'NFT';
  readonly contractPackageHash: Maybe<string>;
  readonly contractHash: Maybe<string>;
  readonly contractLink: Maybe<string>;
}

export interface ITxSignatureRequestCasperMarketAction
  extends ITxSignatureRequestAction,
    Pick<
      ICasperMarketDeploy,
      | 'contractName'
      | 'amountOfNFTs'
      | 'offererHash'
      | 'offererHashType'
      | 'offererAccountInfo'
      | 'collectionHash'
      | 'nftTokenIds'
      | 'iconUrl'
      | 'amount'
      | 'decimalAmount'
      | 'formattedDecimalAmount'
      | 'fiatAmount'
    > {
  readonly entryPoint: string;
  readonly type: 'CSPR_MARKET';
  readonly contractPackageHash: Maybe<string>;
  readonly contractHash: Maybe<string>;
  readonly contractLink: Maybe<string>;
}

export interface ITxSignatureRequestAssociatedKeysAction
  extends ITxSignatureRequestAction,
    Pick<IAssociatedKeysDeploy, 'contractName'> {
  readonly type: 'ASSOCIATED_KEYS';
  readonly contractPackageHash: Maybe<string>;
  readonly contractHash: Maybe<string>;
  readonly contractLink: Maybe<string>;
}

export interface ITxSignatureRequestAuctionAction
  extends ITxSignatureRequestAction,
    Pick<
      IAuctionDeploy,
      | 'contractName'
      | 'fromValidator'
      | 'fromValidatorKeyType'
      | 'fromValidatorAccountInfo'
      | 'toValidator'
      | 'toValidatorKeyType'
      | 'toValidatorAccountInfo'
      | 'decimals'
      | 'symbol'
      | 'amount'
      | 'decimalAmount'
      | 'formattedDecimalAmount'
      | 'fiatAmount'
    > {
  readonly type: 'AUCTION';
  readonly entryPoint: string;
  readonly contractPackageHash: Maybe<string>;
  readonly contractHash: Maybe<string>;
  readonly contractLink: Maybe<string>;
}

export interface ITxSignatureRequestUnknownContractAction extends ITxSignatureRequestAction {
  readonly type: 'UNKNOWN';
  readonly contractName: string;
  readonly contractPackageHash: Maybe<string>;
  readonly contractHash: Maybe<string>;
  readonly contractLink: Maybe<string>;
  readonly entryPoint: string;
  readonly iconUrl: Maybe<string>;
  readonly args: Record<string, ITxSignatureRequestArg>;
}

export interface ITxSignatureRequestArg {
  type: ITxSignatureRequestArgType;
  value: string | ITxSignatureRequestArg[] | Record<string, ITxSignatureRequestArg>;
  accountInfo?: IAccountInfo;
  link?: string;
}

export type ITxSignatureRequestArgType =
  | 'accountLink'
  | 'uref'
  | 'hash'
  | 'number'
  | 'string'
  | 'timestamp'
  | 'list'
  | 'map'
  | 'singleInner'
  | 'resultOk'
  | 'resultErr'
  | 'tuple';

export interface ITxSignatureRequestWasmAction extends ITxSignatureRequestAction {
  readonly type: 'WASM';
  readonly args: Record<string, ITxSignatureRequestArg>;
}

export interface ITxSignatureRequestWasmProxyAction extends ITxSignatureRequestAction {
  readonly type: 'WASM_PROXY';
  readonly contractName: string;
  readonly contractPackageHash: Maybe<string>;
  readonly contractHash: Maybe<string>;
  readonly contractLink: Maybe<string>;
  readonly entryPoint: string;
  readonly iconUrl: Maybe<string>;
  readonly args: Record<string, ITxSignatureRequestArg>;
}
