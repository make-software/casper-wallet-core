import { LRUCache } from 'lru-cache';
import deepmerge from 'deepmerge';
import {
  CSPR_API_PROXY_HEADERS,
  isAccountInfoError,
  AccountInfoError,
  IAccountInfoRepository,
  IAccountInfo,
  DataResponse,
  IGetAccountsInfoParams,
  HttpClientNotFoundError,
  ICsprBalance,
  IGetAccountsBalancesParams,
  CasperNetwork,
} from '../../../domain';
import type { IHttpDataProvider } from '../../../domain';
import { AccountsInfoDto } from '../../dto/accountInfo';
import { CsprBalanceDto } from '../../dto/tokens';
import { ICloudResolveFromCsprNameResponse, IGetAccountsInfoResponse } from './types';

import { isExpired } from '../../../utils/date';
import { Maybe } from '../../../typings';
import { IGetCsprBalanceResponse } from '../tokens';
import { ICloudTransactionFeedItem } from '../deploys';

export * from './types';

export class AccountInfoRepository implements IAccountInfoRepository {
  constructor(
    private _httpProvider: IHttpDataProvider,
    private _casperWalletApiUrl: Record<CasperNetwork, string>,
  ) {}

  private _accountsInfoMapCache = new LRUCache<string, IAccountInfo>({
    max: 1000,
    ttl: 1000 * 60 * 10,
  });

  get accountsInfoMapCache(): Record<string, IAccountInfo> {
    return Object.fromEntries(this._accountsInfoMapCache.entries());
  }

  async getAccountsInfo({
    network,
    accountHashes,
    withProxyHeader = true,
  }: IGetAccountsInfoParams): Promise<Record<string, IAccountInfo>> {
    try {
      const accountsHashesForFetch = accountHashes.filter(
        hash => !this._accountsInfoMapCache.has(hash),
      );

      const resp = await this._httpProvider.post<DataResponse<IGetAccountsInfoResponse[]>>({
        url: `${this._casperWalletApiUrl[network]}/accounts?includes=account_info,centralized_account_info,cspr_name`,
        data: {
          account_hashes: accountsHashesForFetch,
        },
        ...(withProxyHeader ? { headers: CSPR_API_PROXY_HEADERS } : {}),
        errorType: 'getAccountsInfo',
      });

      const remoteAccountsInfo =
        resp?.data
          .map(acc => AccountsInfoDto.fromGetAccountsInfoResponse(network, acc))
          .reduce<Record<string, IAccountInfo>>(
            (acc, cur) => ({
              ...acc,
              [cur.accountHash]: cur,
            }),
            {},
          ) ?? {};

      Object.entries(remoteAccountsInfo).forEach(([key, accInfo]) => {
        const existing = this._accountsInfoMapCache.get(key);
        this._accountsInfoMapCache.set(key, existing ? deepmerge(existing, accInfo) : accInfo);
      });

      return accountHashes.reduce<Record<string, IAccountInfo>>(
        (acc, hash) => ({
          ...acc,
          [hash]: remoteAccountsInfo[hash] ?? this._accountsInfoMapCache.get(hash),
        }),
        {},
      );
    } catch (e) {
      this._processError(e, 'getAccountsInfo');
    }
  }

  async getAccountsBalances({
    network,
    accountHashes,
    withProxyHeader = true,
    withDelegationBalances = false,
  }: IGetAccountsBalancesParams): Promise<Record<string, ICsprBalance>> {
    try {
      const resp = await this._httpProvider.post<DataResponse<IGetCsprBalanceResponse[]>>({
        url: `${this._casperWalletApiUrl[network]}/accounts${withDelegationBalances ? '?includes=delegated_balance,undelegating_balance' : ''}`,
        data: {
          account_hashes: accountHashes,
        },
        ...(withProxyHeader ? { headers: CSPR_API_PROXY_HEADERS } : {}),
        errorType: 'getAccountsBalances',
      });

      return (
        resp?.data
          .map(acc => new CsprBalanceDto(acc))
          .reduce<Record<string, ICsprBalance>>(
            (acc, cur) => ({
              ...acc,
              [cur.accountHash]: cur,
            }),
            {},
          ) ?? {}
      );
    } catch (e) {
      this._processError(e, 'getAccountsBalances');
    }
  }

  async resolveAccountFromCsprName(
    csprName: string,
    network: CasperNetwork,
    withProxyHeader = true,
  ): Promise<Maybe<IAccountInfo>> {
    try {
      const resp = await this._httpProvider.get<DataResponse<ICloudResolveFromCsprNameResponse>>({
        url: `${this._casperWalletApiUrl[network]}/cspr-name-resolutions/${csprName}`,
        params: {
          includes: 'resolved_public_key,account_info,centralized_account_info',
        },
        ...(withProxyHeader ? { headers: CSPR_API_PROXY_HEADERS } : {}),
        errorType: 'resolveAccountFromCsprName',
      });

      return isExpired(resp?.data?.expires_at)
        ? null
        : AccountsInfoDto.fromCsprNameResolution(network, resp?.data);
    } catch (e) {
      if (e instanceof HttpClientNotFoundError) {
        return null;
      }

      this._processError(e, 'resolveAccountFromCsprName');
    }
  }

  getAccountInfoFromTransactionsFeed = async (
    resp: ICloudTransactionFeedItem[],
    network: CasperNetwork,
  ) => {
    const remoteCallerAccountsInfo =
      resp
        ?.map(acc => AccountsInfoDto.fromTransactionFeedCaller(network, acc))
        .reduce<Record<string, IAccountInfo>>(
          (acc, cur) => ({
            ...acc,
            [cur.accountHash]: cur,
          }),
          {},
        ) ?? {};

    const remoteResultsAccountsInfo =
      resp
        ?.map(acc => {
          const transfersInfo =
            acc.transfers
              ?.map(tr => AccountsInfoDto.fromTransactionTransferResult(network, tr))
              .flat() ?? [];
          const ftActionsInfo =
            acc.ft_token_actions
              ?.map(tr => AccountsInfoDto.fromTransactionActionResults(network, tr))
              .flat() ?? [];
          const nftActionsInfo =
            acc.nft_token_actions
              ?.map(tr => AccountsInfoDto.fromTransactionActionResults(network, tr))
              .flat() ?? [];

          return [...transfersInfo, ...ftActionsInfo, ...nftActionsInfo];
        })
        .flat()
        .reduce<Record<string, IAccountInfo>>(
          (acc, cur) => ({
            ...acc,
            [cur.accountHash]: cur,
          }),
          {},
        ) ?? {};

    const remoteAccountsInfo = { ...remoteCallerAccountsInfo, ...remoteResultsAccountsInfo };

    Object.entries(remoteAccountsInfo).forEach(([key, accInfo]) => {
      const existing = this._accountsInfoMapCache.get(key);
      this._accountsInfoMapCache.set(key, existing ? deepmerge(existing, accInfo) : accInfo);
    });

    return remoteAccountsInfo;
  };

  private _processError(e: unknown, type: keyof IAccountInfoRepository): never {
    if (isAccountInfoError(e)) {
      throw e;
    }

    throw new AccountInfoError(e, type);
  }
}
