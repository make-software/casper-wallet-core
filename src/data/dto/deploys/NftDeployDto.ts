import {
  derivePublicKeyFromNftActionResults,
  getAccountInfoFromMap,
  getCollectionHashFormDeploy,
  getEntryPoint,
  getNftTokenIdsFromArguments,
  getNftTokensQuantity,
  guardedDeriveSplitDataFromArguments,
} from './common';
import { DeployDto } from './DeployDto';
import { getNftActionsResult } from './ActionResults';
import { ExtendedCloudDeploy } from '../../repositories';
import { isKeysEqual } from '../../../utils';
import {
  AccountKeyType,
  IAccountInfo,
  INftActionsResult,
  INftDeploy,
  Network,
  NFTEntryPointType,
} from '../../../domain';
import { Maybe } from '../../../typings';

export class NftDeployDto extends DeployDto implements INftDeploy {
  constructor(
    network: Network,
    activePublicKey: string,
    data?: Partial<ExtendedCloudDeploy>,
    accountInfoMap: Record<string, IAccountInfo> = {},
  ) {
    super(network, activePublicKey, data, accountInfoMap);
    this.entryPoint = (getEntryPoint(data) ?? 'transfer') as NFTEntryPointType;
    this.contractName = data?.contract_package?.name ?? '';

    const { recipientKey, recipientKeyType } = getNftRecipientKeys(data);
    this.recipientAccountInfo = getAccountInfoFromMap(
      accountInfoMap,
      recipientKey,
      recipientKeyType,
    );
    this.recipientKey = this.recipientAccountInfo?.publicKey ?? recipientKey;
    this.recipientKeyType = this.recipientAccountInfo?.publicKey ? 'publicKey' : recipientKeyType;

    this.amountOfNFTs = getNftTokensQuantity(data, ['approve', 'update_token_meta']);
    this.nftTokenIds = data?.args ? getNftTokenIdsFromArguments(data?.args) : [];
    this.nftActionsResult = getNftActionsResult(activePublicKey, data, accountInfoMap);
    this.iconUrl = data?.contract_package?.icon_url ?? null;
    this.isReceive = isKeysEqual(activePublicKey, this.recipientKey);
    this.collectionHash = getCollectionHashFormDeploy(data);
  }

  readonly entryPoint: NFTEntryPointType;
  readonly contractName: string;
  readonly amountOfNFTs: Maybe<number>;
  readonly nftTokenIds: string[];
  readonly nftActionsResult: INftActionsResult[];
  readonly iconUrl: Maybe<string>;
  readonly recipientKey: string;
  readonly recipientAccountInfo: Maybe<IAccountInfo>;
  readonly recipientKeyType: AccountKeyType;
  readonly isReceive: boolean;
  readonly collectionHash: string;
}

export function getNftRecipientKeys(
  data?: Partial<ExtendedCloudDeploy>,
): Pick<INftDeploy, 'recipientKey' | 'recipientKeyType'> {
  const tokenOwner = guardedDeriveSplitDataFromArguments(data?.args?.token_owner, 'Account');
  const owner = guardedDeriveSplitDataFromArguments(data?.args?.owner, 'Account');
  const sourceKey = guardedDeriveSplitDataFromArguments(data?.args?.source_key, 'Account');
  const targetKey = guardedDeriveSplitDataFromArguments(data?.args?.target_key, 'Account');
  const recipientHash = guardedDeriveSplitDataFromArguments(data?.args?.recipient, 'Account');
  const accountSpenderHash = guardedDeriveSplitDataFromArguments(data?.args?.spender, 'Account');
  const contractSpenderHash = guardedDeriveSplitDataFromArguments(data?.args?.spender, 'Hash');
  const operatorHash = guardedDeriveSplitDataFromArguments(data?.args?.operator, 'Hash');

  const hashInfo =
    recipientHash ??
    tokenOwner ??
    accountSpenderHash ??
    owner ??
    targetKey ??
    sourceKey ??
    contractSpenderHash ??
    operatorHash;

  if (hashInfo?.keyType === 'accountHash' && hashInfo?.hash) {
    const publicKey = derivePublicKeyFromNftActionResults(hashInfo.hash, data);

    if (publicKey) {
      return {
        recipientKey: publicKey,
        recipientKeyType: 'publicKey',
      };
    }
  }

  return {
    recipientKey: hashInfo?.hash ?? '',
    recipientKeyType: hashInfo?.keyType ?? 'accountHash',
  };
}
