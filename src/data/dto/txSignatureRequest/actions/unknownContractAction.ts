import { Transaction } from 'casper-js-sdk';
import {
  IAccountInfo,
  IContractPackage,
  ITxSignatureRequestUnknownContractAction,
} from '../../../../domain';
import { Maybe } from '../../../../typings';
import { getContractInfo } from '../common';
import { getTxSignatureRequestArgs } from './argumentsParser';

export function getTxSignatureRequestUnknownContractAction(
  tx: Transaction,
  accountInfoMap: Record<string, IAccountInfo> = {},
  contractPackage: Maybe<IContractPackage>,
): ITxSignatureRequestUnknownContractAction {
  return {
    ...getContractInfo(tx, contractPackage),
    args: getTxSignatureRequestArgs(tx.args, accountInfoMap, tx.chainName),
    iconUrl: contractPackage?.iconUrl ?? null,
    entryPoint: tx.entryPoint.customEntryPoint ?? '',
    type: 'UNKNOWN',
  };
}
