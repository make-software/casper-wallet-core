import { Conversions, Transaction } from 'casper-js-sdk';
import { IAccountInfo, ITxSignatureRequestWasmAction } from '../../../../domain';
import { getTxSignatureRequestArgs } from './argumentsParser';
import { blake2b } from '@noble/hashes/blake2';

export function getTxSignatureRequestWasmAction(
  tx: Transaction,
  accountInfoMap: Record<string, IAccountInfo> = {},
): ITxSignatureRequestWasmAction {
  return {
    type: 'WASM',
    args: getTxSignatureRequestArgs(tx.args, accountInfoMap, tx.chainName),
    washHash: Conversions.encodeBase16(
      blake2b(tx.target.session?.moduleBytes ?? new Uint8Array(), { dkLen: 32 }),
    ),
  };
}
