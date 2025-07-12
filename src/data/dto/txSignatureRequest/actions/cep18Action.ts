import { Transaction } from 'casper-js-sdk';
import {
  IAccountInfo,
  ICep18Deploy,
  IContractPackage,
  ITxSignatureRequestCep18Action,
} from '../../../../domain';
import { Maybe } from '../../../../typings';
import { formatTokenBalance, getDecimalTokenBalance } from '../../../../utils';
import { getAccountKeyDataFromCLValue, getContractInfo } from '../common';
import { getAccountInfoFromMap } from '../../common';

export function getTxSignatureRequestCep18Action(
  tx: Transaction,
  accountInfoMap: Record<string, IAccountInfo> = {},
  contractPackage: Maybe<IContractPackage>,
): ITxSignatureRequestCep18Action {
  const decimals = contractPackage?.decimals ?? 18;
  const symbol = contractPackage?.symbol ?? '';

  const amount = tx.args.getByName('amount')?.toString() ?? '0';

  const { recipientKey, recipientKeyType } = getCep18RecipientKeyAndType(tx);

  const recipientAccountInfo = getAccountInfoFromMap(
    accountInfoMap,
    recipientKey,
    recipientKeyType,
  );

  return {
    amount,
    decimalAmount: getDecimalTokenBalance(amount, decimals),
    formattedDecimalAmount: formatTokenBalance(amount, decimals),
    fiatAmount: '',
    recipientAccountInfo,
    recipientKey: recipientAccountInfo?.publicKey ?? recipientKey,
    recipientKeyType: recipientAccountInfo?.publicKey ? 'publicKey' : recipientKeyType,
    decimals,
    symbol,
    type: 'CEP18',
    entryPoint: tx.entryPoint.customEntryPoint ?? '',
    iconUrl: contractPackage?.iconUrl ?? null,
    ...getContractInfo(tx, contractPackage),
  };
}

function getCep18RecipientKeyAndType(
  tx: Transaction,
): Pick<ICep18Deploy, 'recipientKey' | 'recipientKeyType'> {
  const recipient = getAccountKeyDataFromCLValue(tx.args.getByName('recipient'));
  const owner = getAccountKeyDataFromCLValue(tx.args.getByName('owner'));
  const spender = getAccountKeyDataFromCLValue(tx.args.getByName('spender'));

  const info = recipient ?? owner ?? spender;

  return {
    recipientKey: info?.accountKey ?? '',
    recipientKeyType: info?.keyType ?? 'accountHash',
  };
}
