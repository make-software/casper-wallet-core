import { IAccountInfo } from './entities';
import { Network } from '../common';
import { Maybe } from '../../typings';
import { ICsprBalance } from '../tokens';

export interface IGetAccountsInfoParams {
  accountHashes: string[];
  network: Network;
  withProxyHeader?: boolean;
}

export interface IAccountInfoRepository {
  readonly accountsInfoMapCache: Record<string, IAccountInfo>;
  /** Method makes local cache - {accountsInfoMapCash} */
  getAccountsInfo(params: IGetAccountsInfoParams): Promise<Record<string, IAccountInfo>>;
  resolveAccountFromCsprName(
    csprName: string,
    network: Network,
    withProxyHeader?: boolean,
  ): Promise<Maybe<IAccountInfo>>;
  getAccountsBalances(params: IGetAccountsBalancesParams): Promise<Record<string, ICsprBalance>>;
}

export interface IGetAccountsBalancesParams extends IGetAccountsInfoParams {
  withDelegationBalances?: boolean;
}
