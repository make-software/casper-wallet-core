import { Transaction } from 'casper-js-sdk';
import {
  CSPR_COIN,
  IAccountInfo,
  ICasperMarketDeploy,
  IContractPackage,
  ITxSignatureRequestCasperMarketAction,
} from '../../../../domain';
import { Maybe } from '../../../../typings';
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
  contractPackage: Maybe<IContractPackage>,
  collectionContractPackage: Maybe<IContractPackage>,
): ITxSignatureRequestCasperMarketAction {
  const amount = tx.args.getByName('amount')?.toString() ?? '0';

  const { offererHash, offererHashType } = getOffererFormTx(tx);
  const offererAccountInfo = getAccountInfoFromMap(accountInfoMap, offererHash, offererHashType);

  const collectionHash = getCollectionHashFormArgs(tx);
  const nftTokenIds = getNftTokenIdsFromArguments(tx);
  const nftTokenUrlsMap = getNftTokenUrlsMap(nftTokenIds, tx.chainName, collectionHash);

  return {
    type: 'CSPR_MARKET',
    amount,
    decimalAmount: getDecimalTokenBalance(amount, CSPR_COIN.decimals),
    formattedDecimalAmount: formatTokenBalance(amount, CSPR_COIN.decimals),
    fiatAmount: getCsprFiatAmount(amount, csprFiatRate),
    collectionHash,
    collectionName: collectionContractPackage?.name ?? null,
    entryPoint: tx.entryPoint.customEntryPoint ?? '',
    iconUrl: contractPackage?.iconUrl ?? null,
    amountOfNFTs: getNftTokensQuantity(tx, ['list_token', 'delist_token']),
    nftTokenIds,
    nftTokenUrlsMap,
    offererAccountInfo,
    offererHash: offererAccountInfo?.publicKey ?? offererHash,
    offererHashType: offererAccountInfo?.publicKey ? 'publicKey' : offererHashType,
    ...getContractInfo(tx, contractPackage),
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
