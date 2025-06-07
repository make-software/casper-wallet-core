import { Transaction } from 'casper-js-sdk';
import { IAccountInfo, ITxSignatureRequestUnknownContractAction } from '../../../../domain';
import { Maybe } from '../../../../typings';
import { IContractPackageCloudResponse } from '../../../repositories';
import { getContractInfo } from '../common';
import { getTxSignatureRequestArgs } from './argumentsParser';

export function getTxSignatureRequestUnknownContractAction(
  tx: Transaction,
  accountInfoMap: Record<string, IAccountInfo> = {},
  contractPackage: Maybe<IContractPackageCloudResponse>,
): ITxSignatureRequestUnknownContractAction {
  return {
    ...getContractInfo(tx, contractPackage),
    args: getTxSignatureRequestArgs(tx.args, accountInfoMap, tx.chainName),
    iconUrl: contractPackage?.icon_url ?? null,
    entryPoint: tx.entryPoint.customEntryPoint ?? '',
    type: 'UNKNOWN',
  };
}
