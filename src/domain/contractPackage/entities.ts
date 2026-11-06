import { Maybe } from '../../typings';
import { IEntity } from '../common';

export interface IContractPackage extends IEntity {
  readonly latestVersionContractTypeId: number;
  readonly contractPackageHash: string;
  readonly name: string;
  readonly iconUrl: Maybe<string>;

  readonly symbol: string;
  readonly decimals: number;
  /** False when the API sent no valid `metadata.decimals`, so `decimals` is a 0 placeholder. */
  readonly hasDecimals?: boolean;
}
