import { Transaction } from 'casper-js-sdk';
import { IAccountInfo, ITxSignatureRequestWasmAction } from '../../../../domain';
import { getTxSignatureRequestArgs } from './argumentsParser';

export function getTxSignatureRequestWasmAction(
  tx: Transaction,
  accountInfoMap: Record<string, IAccountInfo> = {},
): ITxSignatureRequestWasmAction {
  return { type: 'WASM', args: getTxSignatureRequestArgs(tx.args, accountInfoMap, tx.chainName) };
}
