import {
  Args,
  ContractCallBuilder,
  ContractHash,
  Deploy,
  DeployHeader,
  Duration,
  ExecutableDeployItem,
  PublicKey,
  RpcClient,
  SessionBuilder,
  StoredVersionedContractByHash,
  Transaction,
} from 'casper-js-sdk';

import { DEX_TRANSACTION_TTL_MS } from '../../../domain';

export const createContractPackageCallTransaction = (params: {
  publicKey: string;
  chainName: string;
  entryPoint: string;
  paymentMotes: string;
  runtimeArgs: Args;
  contractPackageHash: string;
  gasPriceTolerance: number;
}): Transaction => {
  const {
    publicKey,
    chainName,
    entryPoint,
    paymentMotes,
    runtimeArgs,
    contractPackageHash,
    gasPriceTolerance,
  } = params;

  return new ContractCallBuilder()
    .from(PublicKey.fromHex(publicKey))
    .byPackageHash(contractPackageHash.replace('hash-', ''))
    .entryPoint(entryPoint)
    .runtimeArgs(runtimeArgs)
    .chainName(chainName)
    .payment(Number(paymentMotes), gasPriceTolerance)
    .ttl(DEX_TRANSACTION_TTL_MS)
    .build();
};

/** Nodes still on Casper 1.5 need the legacy `buildFor1_5()` encoding, hence the status probe. */
export const createSessionWasmTransaction = async (params: {
  publicKey: string;
  chainName: string;
  paymentMotes: string;
  wasmBinary: Uint8Array;
  runtimeArgs: Args;
  gasPriceTolerance: number;
  rpcClient: RpcClient;
}): Promise<Transaction> => {
  const {
    publicKey,
    chainName,
    paymentMotes,
    wasmBinary,
    runtimeArgs,
    gasPriceTolerance,
    rpcClient,
  } = params;

  const status = await rpcClient.getStatus();
  const apiVersion = status.apiVersion.startsWith('2.') ? 2 : 1;

  const sessionWasm = new SessionBuilder()
    .from(PublicKey.fromHex(publicKey))
    .chainName(chainName)
    .payment(Number(paymentMotes), gasPriceTolerance)
    .ttl(DEX_TRANSACTION_TTL_MS)
    .wasm(wasmBinary)
    .installOrUpgrade()
    .runtimeArgs(runtimeArgs);

  if (apiVersion === 2) {
    return sessionWasm.build();
  }

  return sessionWasm.buildFor1_5();
};

/** Legacy-Deploy counterpart of {@link createContractPackageCallTransaction}. */
export const createContractDeploy = (params: {
  publicKey: string;
  chainName: string;
  paymentMotes: string;
  entryPoint: string;
  runtimeArgs: Args;
  contractPackageHash: string;
  gasPriceTolerance: number;
}): Deploy => {
  const {
    publicKey,
    chainName,
    paymentMotes,
    entryPoint,
    runtimeArgs,
    contractPackageHash,
    gasPriceTolerance,
  } = params;

  const deployHeader = DeployHeader.default();
  deployHeader.chainName = chainName;
  deployHeader.account = PublicKey.fromHex(publicKey);
  deployHeader.gasPrice = gasPriceTolerance;
  deployHeader.ttl = new Duration(DEX_TRANSACTION_TTL_MS);

  const contractHash = ContractHash.newContract(contractPackageHash.replace('hash-', ''));

  const payment = ExecutableDeployItem.standardPayment(paymentMotes);

  const session = new ExecutableDeployItem();
  session.storedVersionedContractByHash = new StoredVersionedContractByHash(
    contractHash,
    entryPoint,
    runtimeArgs,
  );

  return Deploy.makeDeploy(deployHeader, payment, session);
};

/** Legacy-Deploy counterpart of {@link createSessionWasmTransaction}. */
export const createWASMContractDeploy = (params: {
  publicKey: string;
  chainName: string;
  paymentMotes: string;
  wasmBinary: Uint8Array;
  runtimeArgs: Args;
  gasPriceTolerance: number;
}): Deploy => {
  const { publicKey, chainName, paymentMotes, wasmBinary, runtimeArgs, gasPriceTolerance } = params;

  const deployHeader = DeployHeader.default();
  deployHeader.chainName = chainName;
  deployHeader.account = PublicKey.fromHex(publicKey);
  deployHeader.gasPrice = gasPriceTolerance;
  deployHeader.ttl = new Duration(DEX_TRANSACTION_TTL_MS);

  const payment = ExecutableDeployItem.standardPayment(paymentMotes);

  const session = ExecutableDeployItem.newModuleBytes(wasmBinary, runtimeArgs);

  return Deploy.makeDeploy(deployHeader, payment, session);
};
