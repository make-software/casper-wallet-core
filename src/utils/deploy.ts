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
import { Deploy } from 'casper-js-sdk/dist/lib/DeployUtil';
import { TransactionV1 } from 'casper-js-sdk/dist/lib/TransactionUtil';

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

export const getDeployFromJson = (json: string): Maybe<Deploy> => {
  try {
    const data: Record<string, any> = JSON.parse(json);

    const deploy: Maybe<Deploy> =
      data.deploy ?? data.Deploy ?? data?.transaction?.Deploy ?? data ?? null;

    if (deploy?.hash && deploy?.header?.account) {
      return deploy;
    }

    return null;
  } catch (e) {
    return null;
  }
};

export const getTransactionV1FromJson = (json: string): Maybe<TransactionV1> => {
  try {
    const data: Record<string, any> = JSON.parse(json);
    const tx: Maybe<TransactionV1> = data?.transaction?.Version1 ?? data?.Version1 ?? data ?? null;

    if (tx?.hash && tx?.header?.initiatorAddr) {
      return tx;
    }

    return null;
  } catch (e) {
    return null;
  }
};
