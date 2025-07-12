import {
  getAccountHashFromPublicKey,
  isAuctionDeploy,
  isCasperMarketDeploy,
  isCep18Deploy,
  isKeysEqual,
  isNativeCsprDeploy,
  isNftDeploy,
  isNotEmpty,
} from '../../../utils';
import {
  AccountKeyType,
  AssociatedKeysContractHash,
  AuctionManagerContractHash,
  CSPRMarketContractHash,
  CSPRStudioCep47ContractHash,
  DeployType,
  IDeploy,
  Network,
} from '../../../domain';

import { ExtendedCloudDeploy, ExtendedDeployArgsResult, IApiDeployArgs } from '../../repositories';
import { Maybe } from '../../../typings';
import { ContractTypeId, getHashByType } from '../common';

export function getDeployType(network: Network, deploy?: Partial<ExtendedCloudDeploy>): DeployType {
  const contractTypeId =
    deploy?.contract_package?.latest_version_contract_type_id ||
    deploy?.contract_package?.contract_type_id;

  if (
    deploy?.contract_package?.name === 'Auction' ||
    deploy?.contract_hash === AuctionManagerContractHash[network]
  ) {
    return 'AUCTION';
  } else if (deploy?.contract_hash === AssociatedKeysContractHash[network]) {
    return 'ASSOCIATED_KEYS';
  } else if (
    deploy?.contract_hash === CSPRMarketContractHash[network] ||
    deploy?.contract_package?.contract_package_hash === CSPRMarketContractHash[network]
  ) {
    return 'CSPR_MARKET';
  } else if (
    contractTypeId === ContractTypeId.CustomCep18 ||
    contractTypeId === ContractTypeId.Cep18
  ) {
    return 'CEP18';
  } else if (
    contractTypeId === ContractTypeId.CEP78Nft ||
    contractTypeId === ContractTypeId.CEP47Nft ||
    contractTypeId === ContractTypeId.CustomCEP78Nft ||
    contractTypeId === ContractTypeId.CustomCEP47Nft ||
    contractTypeId === ContractTypeId.CEP95NFT
  ) {
    return 'NFT';
  } else if (deploy?.contract_package?.name === 'Mint' || deploy?.execution_type_id === 6) {
    return 'CSPR_NATIVE';
  }

  return 'UNKNOWN';
}

export function getDeployAmount(deployArgs?: Partial<IApiDeployArgs>) {
  const parsed = deployArgs?.amount?.parsed;

  if (!parsed) {
    return '0';
  }

  if (typeof parsed === 'string' || typeof parsed === 'number') {
    return String(parsed);
  }

  return '0';
}

export const getAccountHashesFromDeploy = (deploy: IDeploy): string[] => {
  if (isNativeCsprDeploy(deploy) || isCep18Deploy(deploy) || isNftDeploy(deploy)) {
    return [
      getHashByType(deploy.callerPublicKey),
      getHashByType(deploy.recipientKey, deploy.recipientKeyType),
    ].filter(isNotEmpty<string>);
  }

  if (isAuctionDeploy(deploy)) {
    return [
      getHashByType(deploy.fromValidator, 'publicKey'),
      getHashByType(deploy.toValidator, 'publicKey'),
    ].filter(isNotEmpty<string>);
  }

  if (isCasperMarketDeploy(deploy)) {
    return [getHashByType(deploy.offererHash, deploy.offererHashType)].filter(isNotEmpty<string>);
  }

  return [];
};

export const getAccountHashesFromDeployActionResults = (deploy: IDeploy): string[] => {
  let hashes: string[] = [];

  if (isCep18Deploy(deploy)) {
    hashes = [
      ...hashes,
      ...[
        ...deploy.cep18ActionsResult
          .map(res => [getHashByType(res.callerPublicKey), getHashByType(res.recipientKey)])
          .flat(),
      ].filter(isNotEmpty<string>),
    ];
  }

  if (isCasperMarketDeploy(deploy) || isNftDeploy(deploy)) {
    hashes = [
      ...hashes,
      ...[
        ...deploy.nftActionsResult
          .map(res => [getHashByType(res.callerPublicKey), getHashByType(res.recipientKey)])
          .flat(),
      ].filter(isNotEmpty<string>),
    ];
  }

  return [
    ...hashes,
    ...[
      ...deploy.transfersActionsResult
        .map(res => [getHashByType(res.callerPublicKey), getHashByType(res.recipientKey)])
        .flat(),
    ].filter(isNotEmpty<string>),
  ];
};

export const getNftTokensQuantity = (
  data?: Partial<ExtendedCloudDeploy>,
  excludedEntryPoints: string[] = [],
) => {
  if (data?.entry_point?.name && excludedEntryPoints.includes(data?.entry_point?.name)) {
    return null;
  }

  const args = data?.args;

  if (args?.token_ids || args?.token_metas || args?.tokens) {
    return (((args.token_ids || args.token_metas || args.tokens)?.parsed || []) as any[]).length;
  }

  if (args?.token_meta_data || args?.token_id) {
    return 1;
  }

  return null;
};

export function getEntryPoint(data?: Partial<ExtendedCloudDeploy>) {
  return data?.entry_point?.name ?? data?.contract_entrypoint?.name;
}

export function derivePublicKeyFromTransfersActionResults(
  accountHash: string,
  deploy?: Partial<ExtendedCloudDeploy>,
) {
  return deploy?.transfers
    ?.reduce<string[]>((acc, cur) => {
      return [
        ...acc,
        ...[cur.to_purse_public_key, cur.from_purse_public_key].filter(isNotEmpty<string>),
      ];
    }, [])
    .find(publicKey => isKeysEqual(getAccountHashFromPublicKey(publicKey), accountHash));
}

export function derivePublicKeyFromNftActionResults(
  accountHash: string,
  deploy?: Partial<ExtendedCloudDeploy>,
) {
  return deploy?.nft_token_actions
    ?.reduce<string[]>((acc, cur) => {
      return [...acc, ...[cur.to_public_key, cur.from_public_key].filter(isNotEmpty<string>)];
    }, [])
    .find(publicKey => isKeysEqual(getAccountHashFromPublicKey(publicKey), accountHash));
}

export const getNftTokenIdsFromArguments = (args: ExtendedDeployArgsResult) => {
  const hasTokens =
    args.token_metas?.parsed ||
    args.token_id?.parsed ||
    args.token_ids?.parsed ||
    args?.tokens?.parsed;

  const getTokenIdsFromClValue = (clValue: any) =>
    clValue?.parsed
      ? clValue?.parsed.map((token: any) => (typeof token === 'string' ? token : token.key))
      : [];

  if (hasTokens) {
    const tokens = [
      ...getTokenIdsFromClValue(args.token_ids),
      ...getTokenIdsFromClValue(args.token_metas),
      ...getTokenIdsFromClValue(args.tokens),
    ];

    const ids = [...tokens, args.token_id?.parsed].filter(isNotEmpty<string>);

    return [...new Set(ids)];
  }

  return [];
};

interface SplitDataType {
  prefix: string;
  hash: string;
}

interface DerivedHashInfo extends SplitDataType {
  keyType: AccountKeyType;
}

export const guardedDeriveSplitDataFromArguments = (
  argument: any,
  parsedKey: string,
): Maybe<DerivedHashInfo> => {
  const parsedKeyToKeyTypeMap: Record<string, AccountKeyType> = {
    Account: 'accountHash',
    Hash: 'contractHash',
    PublicKey: 'publicKey',
  };

  if (typeof argument?.parsed?.[parsedKey] === 'string') {
    return {
      ...deriveSplitDataFromNamedKeyValue(argument.parsed[parsedKey]),
      keyType: parsedKeyToKeyTypeMap[parsedKey] ?? 'accountHash',
    };
  }

  return null;
};

export enum NamedKeyPrefix {
  HASH = 'hash-',
  CONTRACT = 'contract-',
  UREF = 'uref-',
  DEPLOY = 'deploy-',
  ERA_INFO_PREFIX = 'era-',
  BALANCE_PREFIX = 'balance-',
  BID_PREFIX = 'bid-',
  WITHDRAW_PREFIX = 'withdraw-',
  DICTIONARY_PREFIX = 'dictionary-',
  ACCOUNT_HASH = 'account-hash-',
  CONTRACT_PACKAGE = 'contract-package-',
}

export const hashPrefixRegEx = new RegExp(
  `(${Object.values(NamedKeyPrefix).join('|')})(?=[0-9a-fA-F])`,
  'i',
);

export const deriveSplitDataFromNamedKeyValue = (namedKeyValue: string): SplitDataType => {
  const [hash, lastDigits] = namedKeyValue.replace(hashPrefixRegEx, '').split('-');

  const formattedPrefix = namedKeyValue.match(hashPrefixRegEx)
    ? namedKeyValue.match(hashPrefixRegEx)![0]
    : '';
  const formattedHash = lastDigits ? `${hash}-${lastDigits}` : `${hash}`;

  return {
    prefix: formattedPrefix,
    hash: formattedHash,
  };
};

export function getCollectionHashFormDeploy(
  network: Network,
  contractHash: string,
  contractPackageHash: string,
  deploy?: Partial<ExtendedCloudDeploy>,
) {
  const collection = deploy?.args?.collection;

  if (collection?.cl_type === 'Key') {
    if (typeof collection.parsed === 'string') {
      return deriveSplitDataFromNamedKeyValue(collection.parsed).hash;
    } else if (typeof collection.parsed === 'object' && collection.parsed) {
      if ('Hash' in collection.parsed) {
        return deriveSplitDataFromNamedKeyValue(collection.parsed.Hash || '').hash;
      }
    }

    return '';
  }

  return isKeysEqual(CSPRStudioCep47ContractHash[network], contractHash)
    ? contractHash
    : contractPackageHash;
}
