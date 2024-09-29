import { IAccountInfo } from './entities';
import { Network } from '../common';
import { Maybe } from '../../typings';
import { ICsprBalance } from '../tokens';

export interface IGetAccountsInfoParams {
  accountHashes: string[];
  network: Network;
}

export interface IAccountInfoRepository {
  readonly accountsInfoMapCache: Record<string, IAccountInfo>;
  /** Method makes local cache - {accountsInfoMapCash} */
  getAccountsInfo(params: IGetAccountsInfoParams): Promise<Record<string, IAccountInfo>>;
  resolveAccountFromCsprName(csprName: string): Promise<Maybe<IAccountInfo>>;
  getAccountsBalances(params: IGetAccountsInfoParams): Promise<Record<string, ICsprBalance>>;
}
