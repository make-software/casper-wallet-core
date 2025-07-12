import { Transaction } from 'casper-js-sdk';
import { IAccountInfo, IContractPackage, ITxSignatureRequestNFTAction } from '../../../../domain';
import { Maybe } from '../../../../typings';
import { getAccountInfoFromMap, getNftTokenUrlsMap } from '../../common';
import {
  getAccountKeyDataFromCLValue,
  getCollectionHashFormArgs,
  getContractInfo,
  getNftTokenIdsFromArguments,
  getNftTokensQuantity,
} from '../common';

export function getTxSignatureRequestNFTAction(
  tx: Transaction,
  accountInfoMap: Record<string, IAccountInfo> = {},
  contractPackage: Maybe<IContractPackage>,
  collectionContractPackage: Maybe<IContractPackage>,
): ITxSignatureRequestNFTAction {
  const { recipientKey, recipientKeyType } = getNftRecipientKeys(tx);
  const recipientAccountInfo = getAccountInfoFromMap(
    accountInfoMap,
    recipientKey,
    recipientKeyType,
  );

  const collectionHash = getCollectionHashFormArgs(tx);
  const nftTokenIds = getNftTokenIdsFromArguments(tx);
  const nftTokenUrlsMap = getNftTokenUrlsMap(nftTokenIds, tx.chainName, collectionHash);

  return {
    type: 'NFT',
    entryPoint: tx.entryPoint.customEntryPoint ?? '',
    amountOfNFTs: getNftTokensQuantity(tx, ['approve', 'update_token_meta']),
    iconUrl: contractPackage?.iconUrl ?? null,
    nftTokenIds,
    nftTokenUrlsMap,
    recipientAccountInfo,
    recipientKey: recipientAccountInfo?.publicKey ?? recipientKey,
    recipientKeyType: recipientAccountInfo?.publicKey ? 'publicKey' : recipientKeyType,
    collectionHash,
    collectionName: collectionContractPackage?.name ?? null,
    ...getContractInfo(tx, contractPackage),
  };
}

function getNftRecipientKeys(
  tx: Transaction,
): Pick<ITxSignatureRequestNFTAction, 'recipientKey' | 'recipientKeyType'> {
  const tokenOwner = getAccountKeyDataFromCLValue(tx.args.getByName('token_owner'));
  const owner = getAccountKeyDataFromCLValue(tx.args.getByName('owner'));
  const sourceKey = getAccountKeyDataFromCLValue(tx.args.getByName('source_key'));
  const targetKey = getAccountKeyDataFromCLValue(tx.args.getByName('target_key'));
  const recipient = getAccountKeyDataFromCLValue(tx.args.getByName('recipient'));
  const accountSpender = getAccountKeyDataFromCLValue(tx.args.getByName('spender'));
  const contractSpender = getAccountKeyDataFromCLValue(tx.args.getByName('spender'));
  const operator = getAccountKeyDataFromCLValue(tx.args.getByName('operator'));

  const hashInfo =
    recipient ??
    tokenOwner ??
    accountSpender ??
    owner ??
    targetKey ??
    sourceKey ??
    contractSpender ??
    operator;

  return {
    recipientKey: hashInfo?.accountKey ?? '',
    recipientKeyType: hashInfo?.keyType ?? 'accountHash',
  };
}
