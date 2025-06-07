import { Transaction } from 'casper-js-sdk';
import { Maybe } from '../../../../typings';
import { IContractPackageCloudResponse } from '../../../repositories';
import { ITxSignatureRequestAssociatedKeysAction } from '../../../../domain';
import { getContractInfo } from '../common';

export function getTxSignatureRequestAssociatedKeysAction(
  tx: Transaction,
  contractPackage: Maybe<IContractPackageCloudResponse>,
): ITxSignatureRequestAssociatedKeysAction {
  return { type: 'ASSOCIATED_KEYS', ...getContractInfo(tx, contractPackage) };
}
