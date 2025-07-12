import {
  formatFiatBalance,
  getAccountHashFromPublicKey,
  getContractNftUrl,
  getDecimalTokenBalance,
  isPublicKeyHash,
} from '../../utils';
import Decimal from 'decimal.js';
import { AccountKeyType, CSPR_COIN, IAccountInfo } from '../../domain';
import { Maybe } from '../../typings';

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
