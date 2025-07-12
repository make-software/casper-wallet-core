import { Network } from '../common';
import { IContractPackage } from './entities';
import { Maybe } from '../../typings';

export interface IContractPackageRepository {
  getContractPackage(params: IGetContractPackageParams): Promise<Maybe<IContractPackage>>;
}

export interface IGetContractPackageParams {
  contractPackageHash: string;
  network: Network;
  withProxyHeader?: boolean;
}
