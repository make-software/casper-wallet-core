import {
  formatFiatBalance,
  getAccountHashFromPublicKey,
  getContractNftUrl,
  getDecimalTokenBalance,
  isPublicKeyHash,
} from '../../utils';
import Decimal from 'decimal.js';
import {
  AccountKeyType,
  CEP_18_ACTION_ENTRY_POINTS,
  CSPR_COIN,
  IAccountInfo,
  NFT_ACTION_ENTRY_POINTS,
  SupportedMarketDataProviders,
} from '../../domain';
import { Maybe } from '../../typings';
import { ITokenMarketData } from '../repositories';

export function getCsprFiatAmount(amount: string | number, rate?: string | number) {
  const isZeroRate = Number(rate ?? 0) === 0;

  if (isZeroRate) {
    return '';
  }

  return formatFiatBalance(
    new Decimal(getDecimalTokenBalance(amount, CSPR_COIN.decimals)).mul(rate ?? 0).toFixed(),
    undefined,
    2,
  );
}

export function deriveKeyType(key?: Maybe<string>) {
  return isPublicKeyHash(key) ? 'publicKey' : 'accountHash';
}

export const getAccountInfoFromMap = (
  accountsInfoMap: Record<string, IAccountInfo>,
  hash: Maybe<string>,
  keyType?: Maybe<AccountKeyType>,
) => {
  const h = getHashByType(hash, keyType);

  return h ? accountsInfoMap[h] : null;
};

export enum ContractTypeId {
  System = 1,
  Cep18 = 2,
  CustomCep18 = 3,
  CEP47Nft = 4,
  CustomCEP47Nft = 5,
  DeFi = 6,
  CEP78Nft = 7,
  CustomCEP78Nft = 8,
  CSPRMarket = 9,
  CEP95NFT = 10,
}

export function getHashByType(hash: Maybe<string>, keyType?: Maybe<AccountKeyType>) {
  try {
    if (!hash) {
      return null;
    }

    if (keyType === 'publicKey') {
      return getAccountHashFromPublicKey(hash);
    } else if (keyType === 'accountHash') {
      return hash;
    }

    return null;
  } catch (e) {
    return null;
  }
}

export function getNftTokenUrlsMap(
  tokenIds: string[],
  chainName: string,
  collectionHash: Maybe<string>,
) {
  return tokenIds.reduce<Record<string, Maybe<string>>>(
    (acc, id) => ({
      ...acc,
      [id]: getContractNftUrl(chainName, collectionHash, id),
    }),
    {},
  );
}

export function getMarketDataProviderUrl(
  marketDataProvider: Maybe<SupportedMarketDataProviders>,
  coingeckoId?: string | null,
  latestVersionContractHash?: string | null,
) {
  switch (marketDataProvider) {
    case 'CsprTrade':
      return 'https://cspr.trade/'; // TODO link to token page
    case 'CoinGecko':
      return coingeckoId ? `https://www.coingecko.com/en/coins/${coingeckoId}` : null;
    case 'FriendlyMarket':
      return latestVersionContractHash
        ? `https://www.friendly.market/swap/CSPR/${latestVersionContractHash}`
        : null;
    default:
      return null;
  }
}

export function isCep18Action(entryPointName: string, contractTypeId?: Maybe<number>): boolean {
  return (
    (contractTypeId === ContractTypeId.CustomCep18 || contractTypeId === ContractTypeId.Cep18) &&
    CEP_18_ACTION_ENTRY_POINTS.includes(entryPointName.toLowerCase())
  );
}

export function isNftAction(entryPointName: string, contractTypeId?: Maybe<number>): boolean {
  return (
    (contractTypeId === ContractTypeId.CEP78Nft ||
      contractTypeId === ContractTypeId.CEP47Nft ||
      contractTypeId === ContractTypeId.CustomCEP78Nft ||
      contractTypeId === ContractTypeId.CustomCEP47Nft) &&
    NFT_ACTION_ENTRY_POINTS.includes(entryPointName.toLowerCase())
  );
}

export function getPreferredTokenMarketData(tokenMarketData?: ITokenMarketData[] | null) {
  if (!tokenMarketData || !tokenMarketData.length) {
    return null;
  }

  return [...tokenMarketData].sort((a, b) => a.dex_id - b.dex_id)?.[0];
}

export const dexIdToMarketDataProviderMap: Record<number, SupportedMarketDataProviders> = {
  1: 'CsprTrade',
  2: 'CoinGecko',
  3: 'FriendlyMarket',
};
