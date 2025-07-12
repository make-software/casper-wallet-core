import { Transaction } from 'casper-js-sdk';
import { Maybe } from '../../../../typings';
import { IContractPackage, ITxSignatureRequestAssociatedKeysAction } from '../../../../domain';
import { getContractInfo } from '../common';

export function getTxSignatureRequestAssociatedKeysAction(
  tx: Transaction,
  contractPackage: Maybe<IContractPackage>,
): ITxSignatureRequestAssociatedKeysAction {
  return { type: 'ASSOCIATED_KEYS', ...getContractInfo(tx, contractPackage) };
}
