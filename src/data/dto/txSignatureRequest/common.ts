import { Args, CLValue, Transaction, TypeID } from 'casper-js-sdk';
import { Maybe } from '../../../typings';
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
import { IContractPackage, ITxSignatureRequest, ITxSignatureRequestArg } from '../../../domain';
import { getHashByType } from '../common';

export function getContractInfo(tx: Transaction, contractPackage: Maybe<IContractPackage>) {
  const contractPackageHash = tx.target.stored?.id?.byPackageHash?.addr?.toHex?.() ?? null;
  const contractPackageName = tx.target.stored?.id?.byPackageName?.name ?? null;
  const contractHash = tx.target.stored?.id?.byHash?.toHex?.() ?? null;
  const contractName = tx.target.stored?.id?.byName ?? null;
  const contractLink = getBlockExplorerContractPackageUrl(
    tx.chainName,
    contractPackage?.contractPackageHash ?? contractPackageHash,
    contractHash,
  );

  return {
    contractPackageHash: contractPackage?.contractPackageHash ?? contractPackageHash ?? null,
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

export function checkIsWasmProxyTx(tx: Transaction, isWasmProxyOnApi: boolean): boolean {
  const wasmProxyArgs = tx.args;

  const contract_package_hash = getWasmProxyContractPackageHash(wasmProxyArgs);
  const entry_point = wasmProxyArgs.getByName('entry_point');

  return Boolean(isWasmProxyOnApi && contract_package_hash && entry_point);
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
