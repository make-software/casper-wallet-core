import { IEntity } from '../common';
import { Maybe } from '../../typings';

export interface IAccountInfo extends IEntity {
  publicKey: string;
  accountHash: string;
  name: string;
  brandingLogo: Maybe<string>;
  csprName: Maybe<string>;
}
