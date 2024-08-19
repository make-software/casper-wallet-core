import {
  derivePublicKeyFromNftActionResults,
  derivePublicKeyFromTransfersActionResults,
  getAccountInfoFromMap,
  getCsprFiatAmount,
  getDeployAmount,
  getEntryPoint,
  getNftTokenIdsFromArguments,
  getNftTokensQuantity,
  guardedDeriveSplitDataFromArguments,
} from './common';
import { formatTokenBalance, getDecimalTokenBalance } from '../../../utils';
import {
  AccountKeyType,
  CSPR_COIN,
  CSPRMarketEntryPointType,
  IAccountInfo,
  ICasperMarketDeploy,
  INftActionsResult,
  Network,
} from '../../../domain';
import { DeployDto } from './DeployDto';
import { getNftActionsResult } from './ActionResults';
import { ExtendedCloudDeploy } from '../../repositories';
import { Maybe } from '../../../typings';

export class CsprMarketDeployDto extends DeployDto implements ICasperMarketDeploy {
  constructor(
    network: Network,
    activePublicKey: string,
    data?: Partial<ExtendedCloudDeploy>,
    accountInfoMap: Record<string, IAccountInfo> = {},
  ) {
    super(network, activePublicKey, data, accountInfoMap);
    this.entryPoint = (getEntryPoint(data) ?? 'list_token') as CSPRMarketEntryPointType;
    this.amountOfNFTs = getNftTokensQuantity(data, ['list_token', 'delist_token']);
    this.contractName = data?.contract_package?.name ?? '';

    const { offererHash, offererHashType } = getOffererFormDeploy(data);
    this.offererAccountInfo = getAccountInfoFromMap(accountInfoMap, offererHash, offererHashType);
    this.offererHash = this.offererAccountInfo?.publicKey ?? offererHash;
    this.offererHashType = this.offererAccountInfo?.publicKey ? 'publicKey' : offererHashType;

    this.collectionHash = getCollectionHashFormDeploy(data);
    this.nftTokenIds = data?.args ? getNftTokenIdsFromArguments(data?.args) : [];
    this.amount = getDeployAmount(data?.args);
    this.decimalAmount = getDecimalTokenBalance(this.amount, CSPR_COIN.decimals);
    this.formattedDecimalAmount = formatTokenBalance(this.amount, CSPR_COIN.decimals);
    this.nftActionsResult = getNftActionsResult(activePublicKey, data, accountInfoMap);
    this.fiatAmount = getCsprFiatAmount(
      this.amount,
      data?.time_transaction_currency_rate ?? data?.rate,
    );
    this.iconUrl = data?.contract_package?.icon_url ?? null;
  }

  readonly entryPoint: CSPRMarketEntryPointType;
  readonly contractName: string;
  readonly amountOfNFTs: Maybe<number>;
  readonly offererHash: Maybe<string>;
  readonly offererHashType: Maybe<AccountKeyType>;
  readonly offererAccountInfo: Maybe<IAccountInfo>;
  readonly collectionHash: string;
  readonly nftTokenIds: string[];
  readonly amount: string;
  readonly decimalAmount: string;
  readonly formattedDecimalAmount: string;
  readonly fiatAmount: string;
  readonly nftActionsResult: INftActionsResult[];
  readonly iconUrl: Maybe<string>;
}

export function getOffererFormDeploy(
  deploy?: Partial<ExtendedCloudDeploy>,
): Pick<ICasperMarketDeploy, 'offererHash' | 'offererHashType'> {
  const offererHash = guardedDeriveSplitDataFromArguments(deploy?.args?.offerer, 'Account');

  if (offererHash && offererHash.keyType === 'accountHash') {
    const publicKeyInNfts = derivePublicKeyFromNftActionResults(offererHash.hash, deploy);
    const publicKeyInTransfers = derivePublicKeyFromTransfersActionResults(
      offererHash.hash,
      deploy,
    );

    const publicKey = publicKeyInNfts ?? publicKeyInTransfers;

    if (publicKey) {
      return {
        offererHash: publicKey,
        offererHashType: 'publicKey',
      };
    }
  }

  return {
    offererHash: offererHash?.hash ?? '',
    offererHashType: offererHash?.keyType ?? 'accountHash',
  };
}

export function getCollectionHashFormDeploy(deploy?: Partial<ExtendedCloudDeploy>) {
  const collection = deploy?.args?.collection;

  if (collection?.cl_type !== 'Key') {
    return '';
  }

  return collection?.parsed && typeof collection.parsed === 'object' && 'Hash' in collection.parsed
    ? deriveSplitDataFromNamedKeyValue(collection.parsed.Hash || '').hash
    : '';
}

const NamedKeyPrefixes = [
  'hash-',
  'contract-',
  'uref-',
  'deploy-',
  'era-',
  'balance-',
  'bid-',
  'withdraw-',
  'dictionary-',
  'account-hash-',
  'contract-package-',
];

const hashPrefixRegEx = new RegExp(`(${NamedKeyPrefixes.join('|')})(?=[0-9a-fA-F])`, 'i');

function deriveSplitDataFromNamedKeyValue(namedKeyValue: string) {
  const [hash, lastDigits] = namedKeyValue.replace(hashPrefixRegEx, '').split('-');

  const formattedPrefix = namedKeyValue.match(hashPrefixRegEx)?.[0] ?? '';
  const formattedHash = lastDigits ? `${hash}-${lastDigits}` : `${hash}`;

  return {
    prefix: formattedPrefix,
    hash: formattedHash,
  };
}
