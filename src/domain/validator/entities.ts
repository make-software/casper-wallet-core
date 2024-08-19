import { IEntity } from '../common';
import { Maybe } from '../../typings';

export interface IValidator extends IEntity {
  readonly publicKey: string;
  readonly name: string;
  readonly delegatorsNumber: number;
  readonly fee: string;

  readonly totalStake: string;
  readonly formattedTotalStake: string;

  readonly stake: Maybe<string>;
  readonly decimalStake: Maybe<string>;
  readonly formattedDecimalStake: Maybe<string>;

  readonly svgLogo?: string;
  readonly imgLogo?: string;
}
