import { Args, Conversions, Transaction, TypeID } from 'casper-js-sdk';
import { IAccountInfo, ITxSignatureRequestWasmProxyAction } from '../../../../domain';
import { Maybe } from '../../../../typings';
import { IContractPackageCloudResponse } from '../../../repositories';
import { getBlockExplorerContractPackageUrl } from '../../../../utils';
import { getTxSignatureRequestArgs } from './argumentsParser';
import { getWasmProxyContractPackageHash } from '../common';
import { blake2b } from '@noble/hashes/blake2';

export function getTxSignatureRequestWasmProxyAction(
  tx: Transaction,
  accountInfoMap: Record<string, IAccountInfo> = {},
  contractPackage: Maybe<IContractPackageCloudResponse>,
): Maybe<ITxSignatureRequestWasmProxyAction> {
  const wasmProxyArgs = tx.args;

  if (!wasmProxyArgs) {
    return null;
  }

  const contract_package_hash = getWasmProxyContractPackageHash(wasmProxyArgs);
  const entry_point = wasmProxyArgs.getByName('entry_point');
  const args = wasmProxyArgs.getByName('args');

  if (!(contract_package_hash && entry_point)) {
    return null;
  }

  let embeddedArgs: Args | null = null;

  const argsToParse = new Map(wasmProxyArgs.args);

  if (args && args.type.getTypeID() === TypeID.List) {
    // TODO consider get rid of double conversion
    embeddedArgs = Args.fromBytes(
      Conversions.decodeBase16(
        Conversions.encodeBase16(args?.list?.bytes() ?? new Uint8Array()).substring(8),
      ),
    );

    argsToParse.delete('args');
  }

  argsToParse.delete('contract_package_hash');
  argsToParse.delete('entry_point');
  argsToParse.delete('package_hash');
  argsToParse.delete('attached_value');

  const contractPackageHash =
    contract_package_hash.toString() ?? contractPackage?.contract_package_hash ?? '';

  return {
    type: 'WASM_PROXY',
    entryPoint: entry_point.toString(),
    contractPackageHash,
    contractHash: null,
    iconUrl: contractPackage?.icon_url ?? null,
    contractName: contractPackage?.name ?? '',
    contractLink: getBlockExplorerContractPackageUrl(
      tx.chainName,
      contractPackageHash || null,
      null,
    ),
    washHash: Conversions.encodeBase16(
      blake2b(tx.target.session?.moduleBytes ?? new Uint8Array(), { dkLen: 32 }),
    ),
    args: {
      ...getTxSignatureRequestArgs(
        Args.fromMap(Object.fromEntries(argsToParse.entries())),
        accountInfoMap,
        tx.chainName,
      ),
      ...(embeddedArgs?.args.size
        ? getTxSignatureRequestArgs(
            Args.fromMap(Object.fromEntries(embeddedArgs?.args.entries() ?? {})),
            accountInfoMap,
            tx.chainName,
          )
        : {}),
    },
  };
}
