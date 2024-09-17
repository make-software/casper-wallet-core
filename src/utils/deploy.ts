import { CLPublicKey, decodeBase16, DeployUtil } from 'casper-js-sdk';
import {
  IAssociatedKeysDeploy,
  IAuctionDeploy,
  ICasperMarketDeploy,
  ICep18Deploy,
  IDeploy,
  INativeCsprDeploy,
  INftDeploy,
} from '../domain';
import { Maybe } from '../typings';
import { arrayEquals, Deploy } from 'casper-js-sdk/dist/lib/DeployUtil';
import {
  serializeBody,
  serializeHeader,
  TransactionV1,
} from 'casper-js-sdk/dist/lib/TransactionUtil';
import { byteHash } from 'casper-js-sdk/dist/lib/ByteConverters';
import { validateSignature } from 'casper-js-sdk/dist/lib/Keys';
import { TypedJSON } from 'typedjson';

export const isAuctionDeploy = (deploy: IDeploy): deploy is IAuctionDeploy => {
  return deploy.type === 'AUCTION';
};

export const isAssociatedKeysDeploy = (deploy: IDeploy): deploy is IAssociatedKeysDeploy => {
  return deploy.type === 'ASSOCIATED_KEYS';
};

export const isCasperMarketDeploy = (deploy: IDeploy): deploy is ICasperMarketDeploy => {
  return deploy.type === 'CSPR_MARKET';
};

export const isCep18Deploy = (deploy: IDeploy): deploy is ICep18Deploy => {
  return deploy.type === 'CEP18';
};

export const isNativeCsprDeploy = (deploy: IDeploy): deploy is INativeCsprDeploy => {
  return deploy.type === 'CSPR_NATIVE';
};

export const isNftDeploy = (deploy: IDeploy): deploy is INftDeploy => {
  return deploy.type === 'NFT';
};

export const isUnknownDeploy = (deploy: IDeploy): deploy is IDeploy => {
  return deploy.type === 'UNKNOWN';
};

export const isWasmDeployExecutionType = (deploy: IDeploy) => Number(deploy.executionTypeId) === 1;
export const isContractCallExecutionType = (deploy: IDeploy) =>
  Number(deploy.executionTypeId) > 1 && Number(deploy.executionTypeId) < 6;
export const isTransferExecutionType = (deploy: IDeploy) => Number(deploy.executionTypeId) === 6;

export const getDeployFromJson = (json: string | Record<string, any>): Maybe<Deploy> => {
  try {
    const data: Record<string, any> = typeof json === 'string' ? JSON.parse(json) : json;

    const deployJson: Maybe<Record<string, any>> =
      data.deploy ?? data.Deploy ?? data?.transaction?.Deploy ?? data ?? null;

    if (!(deployJson?.hash && deployJson?.header?.account)) {
      return null;
    }

    const res = DeployUtil.deployFromJson({ deploy: deployJson });

    return res.ok ? res.val : null;
  } catch (e) {
    console.log('-------- e', e);
    return null;
  }
};

export const getTransactionV1FromJson = (
  json: string | Record<string, any>,
): Maybe<TransactionV1> => {
  try {
    const data: Record<string, any> = typeof json === 'string' ? JSON.parse(json) : json;
    const tx: Maybe<Record<string, any>> =
      data?.transaction?.Version1 ?? data?.Version1 ?? data ?? null;

    if (!(tx?.hash && tx?.header?.initiator_addr)) {
      return null;
    }

    return transactionV1FromJson(tx);
  } catch (e) {
    console.log('-------- e', e);
    return null;
  }
};

export const validateTransactionV1 = (tx: TransactionV1): TransactionV1 => {
  const serializedBody = serializeBody(tx.body);
  const bodyHash = byteHash(serializedBody);

  if (!arrayEquals(tx.header.bodyHash, bodyHash)) {
    throw new Error(`Invalid tx: bodyHash mismatch. Expected: ${bodyHash},
                  got: ${tx.header.bodyHash}.`);
  }

  const serializedHeader = serializeHeader(tx.header).unwrap();
  const txHash = byteHash(serializedHeader);

  if (!arrayEquals(tx.hash, txHash)) {
    throw new Error(`Invalid tx: hash mismatch. Expected: ${txHash},
                  got: ${tx.hash}.`);
  }

  const isProperlySigned = tx.approvals.every(({ signer, signature }) => {
    const pk = CLPublicKey.fromFormattedString(signer, false);
    const signatureRaw = decodeBase16(signature.slice(2));
    return validateSignature(tx.hash, signatureRaw, pk);
  });

  if (!isProperlySigned) {
    throw new Error('Invalid signature.');
  } else {
    return tx;
  }
};

export const transactionV1FromJson = (json: Record<string, any>): TransactionV1 => {
  let tx = null;

  try {
    const serializer = new TypedJSON(TransactionV1);
    tx = serializer.parse(json);
  } catch (serializationError) {
    throw new Error(`${serializationError}`);
  }

  if (!tx) {
    throw new Error("The JSON can't be parsed as a TransactionV1.");
  }

  return validateTransactionV1(tx);
};
