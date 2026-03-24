import { IAccountInfo } from './entities';
import { CasperNetwork, Network } from '../common';
import { Maybe } from '../../typings';
import { ICsprBalance } from '../tokens';
import { ExtendedCloudDeploy, ICloudTransactionFeedItem } from '../../data/repositories';

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
  getAccountInfoFromTransactionsFeed(
    resp: Array<ICloudTransactionFeedItem | ExtendedCloudDeploy>,
    network: CasperNetwork,
  ): Promise<Record<string, IAccountInfo>>;
}

export interface IGetAccountsBalancesParams extends IGetAccountsInfoParams {
  withDelegationBalances?: boolean;
}
