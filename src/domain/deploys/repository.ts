import { IDeploy } from './entities';
import { CasperNetwork, CloudPaginatedResponse, PaginatedResponse } from '../common';
import { Maybe } from '../../typings';

export interface IDeploysRepository {
  getSingleDeploy(params: IGetSingleDeployParams): Promise<Maybe<IDeploy>>;
  getDeploys(params: IGetDeploysParams): Promise<CloudPaginatedResponse<IDeploy>>;
  getCsprTransferDeploys(params: IGetDeploysParams): Promise<PaginatedResponse<IDeploy>>;
  getCep18TransferDeploys(params: IGetDeploysParams): Promise<PaginatedResponse<IDeploy>>;
}

export interface IGetSingleDeployParams {
  activePublicKey: string;
  network: CasperNetwork;
  deployHash: string;
}

export interface IGetDeploysParams {
  activePublicKey: string;
  network: CasperNetwork;
  page: number;
  limit?: number;
  contractPackageHash?: string;
}
