import { IValidator } from './entities';
import { CasperNetwork } from '../common';

export interface IValidatorsRepository {
  getValidators(params: IGetValidatorsParams): Promise<IValidator[]>;
  getValidatorsWithStakes(params: IGetValidatorsWithStakesParams): Promise<IValidator[]>;
}

export interface IGetValidatorsParams {
  network: CasperNetwork;
}

export interface IGetValidatorsWithStakesParams {
  publicKey: string;
  network: CasperNetwork;
}
