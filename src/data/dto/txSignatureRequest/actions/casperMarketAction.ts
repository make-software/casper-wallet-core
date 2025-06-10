import { Transaction } from 'casper-js-sdk';
import {
  CSPR_COIN,
  IAccountInfo,
  ICasperMarketDeploy,
  ITxSignatureRequestCasperMarketAction,
} from '../../../../domain';
import { Maybe } from '../../../../typings';
import { IContractPackageCloudResponse } from '../../../repositories';
import { getAccountInfoFromMap, getCsprFiatAmount, getNftTokenUrlsMap } from '../../common';
import { formatTokenBalance, getDecimalTokenBalance } from '../../../../utils';
import {
  getAccountKeyDataFromCLValue,
  getCollectionHashFormArgs,
  getContractInfo,
  getNftTokenIdsFromArguments,
  getNftTokensQuantity,
} from '../common';

export function getTxSignatureRequestCasperMarketAction(
  tx: Transaction,
  accountInfoMap: Record<string, IAccountInfo> = {},
  csprFiatRate: string,
  contractPackage: Maybe<IContractPackageCloudResponse>,
): ITxSignatureRequestCasperMarketAction {
  const amount = tx.args.getByName('amount')?.toString() ?? '0';

  const { offererHash, offererHashType } = getOffererFormTx(tx);
  const offererAccountInfo = getAccountInfoFromMap(accountInfoMap, offererHash, offererHashType);

  const { contractHash, ...restContractInfo } = getContractInfo(tx, contractPackage);
  const nftTokenIds = getNftTokenIdsFromArguments(tx);
  const nftTokenUrlsMap = getNftTokenUrlsMap(nftTokenIds, tx.chainName, contractHash);

  return {
    type: 'CSPR_MARKET',
    amount,
    decimalAmount: getDecimalTokenBalance(amount, CSPR_COIN.decimals),
    formattedDecimalAmount: formatTokenBalance(amount, CSPR_COIN.decimals),
    fiatAmount: getCsprFiatAmount(amount, csprFiatRate),
    collectionHash: getCollectionHashFormArgs(tx),
    entryPoint: tx.entryPoint.customEntryPoint ?? '',
    iconUrl: contractPackage?.icon_url ?? null,
    amountOfNFTs: getNftTokensQuantity(tx, ['list_token', 'delist_token']),
    nftTokenIds,
    nftTokenUrlsMap,
    offererAccountInfo,
    offererHash: offererAccountInfo?.publicKey ?? offererHash,
    offererHashType: offererAccountInfo?.publicKey ? 'publicKey' : offererHashType,
    contractHash,
    ...restContractInfo,
  };
}

function getOffererFormTx(
  tx: Transaction,
): Pick<ICasperMarketDeploy, 'offererHash' | 'offererHashType'> {
  const offererHash = getAccountKeyDataFromCLValue(tx.args.getByName('offerer'));

  return {
    offererHash: offererHash?.accountKey ?? '',
    offererHashType: offererHash?.keyType ?? 'accountHash',
  };
}
