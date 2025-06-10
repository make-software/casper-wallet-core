import { Args, CLValue, Conversions, Transaction, TypeID } from 'casper-js-sdk';
import { blake2s } from '@noble/hashes/blake2';
import { Maybe } from '../../../typings';
import { IContractPackageCloudResponse } from '../../repositories';
import {
  getBlockExplorerContractPackageUrl,
  isNotEmpty,
  isPublicKeyHash,
  isTxSignatureRequestAuctionAction,
  isTxSignatureRequestCasperMarketAction,
  isTxSignatureRequestCep18Action,
  isTxSignatureRequestNativeCsprAction,
  isTxSignatureRequestUnknownContractAction,
  isTxSignatureRequestWasmProxyAction,
} from '../../../utils';
import { AccountKeyData } from './types';
import { ITxSignatureRequest, ITxSignatureRequestArg } from '../../../domain';
import { getHashByType } from '../common';

export function getContractInfo(
  tx: Transaction,
  contractPackage: Maybe<IContractPackageCloudResponse>,
) {
  const contractPackageHash = tx.target.stored?.id?.byPackageHash?.addr?.toHex?.() ?? null;
  const contractPackageName = tx.target.stored?.id?.byPackageName?.name ?? null;
  const contractHash = tx.target.stored?.id?.byHash?.toHex?.() ?? null;
  const contractName = tx.target.stored?.id?.byName ?? null;
  const contractLink = getBlockExplorerContractPackageUrl(
    tx.chainName,
    contractPackage?.contract_package_hash ?? contractPackageHash,
    contractHash,
  );

  return {
    contractPackageHash: contractPackage?.contract_package_hash ?? contractPackageHash ?? null,
    contractHash,
    contractName: contractPackage?.name ?? contractPackageName ?? contractName ?? '',
    contractLink,
  };
}

export function getAccountKeyDataFromCLValue(clValue: CLValue | undefined): Maybe<AccountKeyData> {
  if (!(clValue?.type?.getTypeID() === TypeID.Key && clValue.key)) {
    return null;
  }

  const accountKey = clValue.key.account?.toHex();
  const hashKey = clValue.key.hash?.toHex();

  if (!(accountKey || hashKey)) {
    return null;
  }

  return {
    accountKey: accountKey ?? hashKey ?? '',
    keyType: hashKey ? 'contractHash' : 'accountHash',
  };
}

export function getNftTokensQuantity(
  tx: Transaction,
  excludedEntryPoints: string[],
): number | null {
  const entryPoint = tx.entryPoint.customEntryPoint ?? '';

  if (entryPoint && excludedEntryPoints.includes(entryPoint)) {
    return null;
  }

  const token_ids = tx.args.getByName('token_ids');
  const token_metas = tx.args.getByName('token_metas');
  const tokens = tx.args.getByName('tokens');

  if (
    token_ids?.type.getTypeID() === TypeID.List ||
    token_metas?.type.getTypeID() === TypeID.List ||
    tokens?.type.getTypeID() === TypeID.List
  ) {
    return (
      token_ids?.list?.elements?.length ??
      token_metas?.list?.elements?.length ??
      tokens?.list?.elements?.length ??
      null
    );
  }

  const token_meta_data = tx.args.getByName('token_meta_data');
  const token_id = tx.args.getByName('token_id');

  if (token_meta_data || token_id) {
    return 1;
  }

  return null;
}

export function getNftTokenIdsFromArguments(tx: Transaction) {
  const token_id = tx.args.getByName('token_id');
  const token_ids = tx.args.getByName('token_ids');
  const tokens = tx.args.getByName('tokens');

  const ids = [
    ...(token_ids?.list?.toJSON?.() ?? []),
    ...(tokens?.list?.toJSON?.() ?? []),
    token_id?.ui64?.toString(),
  ].filter(isNotEmpty<string>);

  return [...new Set(ids)];
}

export function getCollectionHashFormArgs(tx: Transaction) {
  const collection = getAccountKeyDataFromCLValue(tx.args.getByName('collection'));

  return collection?.keyType === 'contractHash' ? collection.accountKey : '';
}

export function checkIsWasmProxyTx(tx: Transaction): boolean {
  const wasmProxyArgs = tx.args;

  const KNOWN_WASM_PROXY_CONTRACT_HASHES = [
    'd983214a144f4e1b17764c90962eaa16b73b22e7eff31586bd0678d9dca2483e',
    'c96517071826eef0d4378ee3bee8c5e14900acc5286a2d86e59f8879125f35bd',
    'e17e391a80accbe5eddf90ee6ebfbc48218b5d18e85e2c5912db1bb54f69c70e',
    '3c0103725a73eb7a1b26bf942bb3ba6bd0f8a864173072f25dd3e4b9fcc62065',
    '46045ce0805c2265f2a5a1c611867b8fdb1621b4fdc800d8ff9fd7b9bb51ce9c',
    'be3bd714d945e52c8debae6086df9bc2e72658cba9d34cd25f0c9ba1cb90d37d',
    'e17e391a80accbe5eddf90ee6ebfbc48218b5d18e85e2c5912db1bb54f69c70e',
    'afc9afe63dbf71d3db926ac0b72e9f43c952977e45d4c4e172f116b67799ae9c',
  ]; // TODO probably temp

  if (!(wasmProxyArgs && tx.target.session?.moduleBytes)) {
    return false;
  }

  const modulesBytesHash = Conversions.encodeBase16(blake2s(tx.target.session.moduleBytes));

  if (!KNOWN_WASM_PROXY_CONTRACT_HASHES.includes(modulesBytesHash)) {
    return false;
  }

  const contract_package_hash = getWasmProxyContractPackageHash(wasmProxyArgs);
  const entry_point = wasmProxyArgs.getByName('entry_point');

  return Boolean(contract_package_hash && entry_point);
}

export function getWasmProxyContractPackageHash(args: Args): Maybe<CLValue> {
  try {
    return args?.getByName('contract_package_hash') ?? args?.getByName('package_hash') ?? null;
  } catch {
    return null;
  }
}

export const getAccountHashesFromTxSignatureRequest = (
  signatureRequest: ITxSignatureRequest,
): string[] => {
  const hashes: Array<Maybe<string>> = [
    getHashByType(signatureRequest.signingKey, signatureRequest.signingKeyType),
    getHashByType(signatureRequest.senderKey, signatureRequest.senderKeyType),
    ...signatureRequest.signaturesCollected.map(d => getHashByType(d.publicKey, 'publicKey')),
  ];

  if (
    isTxSignatureRequestNativeCsprAction(signatureRequest.action) ||
    isTxSignatureRequestCep18Action(signatureRequest.action) ||
    isTxSignatureRequestNativeCsprAction(signatureRequest.action)
  ) {
    hashes.push(
      getHashByType(signatureRequest.action.recipientKey, signatureRequest.action.recipientKeyType),
    );
  }

  if (isTxSignatureRequestAuctionAction(signatureRequest.action)) {
    hashes.push(
      getHashByType(
        signatureRequest.action.fromValidator,
        signatureRequest.action.fromValidatorKeyType,
      ),
    );
    hashes.push(
      getHashByType(
        signatureRequest.action.toValidator,
        signatureRequest.action.toValidatorKeyType,
      ),
    );
  }

  if (isTxSignatureRequestCasperMarketAction(signatureRequest.action)) {
    hashes.push(
      getHashByType(signatureRequest.action.offererHash, signatureRequest.action.offererHashType),
    );
  }

  if (isTxSignatureRequestUnknownContractAction(signatureRequest.action)) {
    const accountsData = findAccountLinksOnArgs(signatureRequest.action.args);
    hashes.push(...accountsData.map(data => getHashByType(data.accountKey, data.keyType)));
  }

  if (isTxSignatureRequestWasmProxyAction(signatureRequest.action)) {
    const accountsData = findAccountLinksOnArgs(signatureRequest.action.args);
    hashes.push(...accountsData.map(data => getHashByType(data.accountKey, data.keyType)));
  }

  return hashes.filter(isNotEmpty<string>);
};

function findAccountLinksOnArgs(argsMap: Record<string, ITxSignatureRequestArg>): AccountKeyData[] {
  const recursiveFind = (args: ITxSignatureRequestArg[]): Array<Maybe<string>> => {
    return args
      .map(arg => {
        if (typeof arg.value === 'string') {
          return arg.type === 'accountLink' ? [arg.value] : [null];
        } else if (Array.isArray(arg.value)) {
          return recursiveFind(arg.value);
        } else if (typeof arg.value === 'object') {
          return recursiveFind(Object.values(arg.value));
        }

        return [null];
      })
      .flat();
  };

  const hashes = recursiveFind(Object.values(argsMap)).filter(isNotEmpty<string>);
  const uniqueHashes = [...new Set(hashes)];

  return uniqueHashes.map<AccountKeyData>(hash => ({
    accountKey: hash,
    keyType: isPublicKeyHash(hash) ? 'publicKey' : 'accountHash',
  }));
}
