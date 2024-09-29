import { LRUCache } from 'lru-cache';
import {
  CSPR_API_PROXY_HEADERS,
  CasperWalletApiUrl,
  isAccountInfoError,
  AccountInfoError,
  IAccountInfoRepository,
  IAccountInfo,
  DataResponse,
  IGetAccountsInfoParams,
  HttpClientNotFoundError,
  ICsprBalance,
} from '../../../domain';
import type { IHttpDataProvider } from '../../../domain';
import { AccountsInfoDto, AccountsInfoResolutionFromCsprNameDto, CsprBalanceDto } from '../../dto';
import { ICloudResolveFromCsprNameResponse, IGetAccountsInfoResponse } from './types';
import { isExpired } from '../../../utils';
import { Maybe } from '../../../typings';
import { IGetCsprBalanceResponse } from '../tokens';

export * from './types';

export class AccountInfoRepository implements IAccountInfoRepository {
  constructor(private _httpProvider: IHttpDataProvider) {}

  private _accountsInfoMapCache = new LRUCache<string, IAccountInfo>({
    max: 100,
    ttl: 1000 * 60 * 10,
  });

  get accountsInfoMapCache(): Record<string, IAccountInfo> {
    return Object.fromEntries(this._accountsInfoMapCache.entries());
  }

  async getAccountsInfo({
    network,
    accountHashes,
  }: IGetAccountsInfoParams): Promise<Record<string, IAccountInfo>> {
    try {
      const accountsHashesForFetch = accountHashes.filter(
        hash => !this._accountsInfoMapCache.has(hash),
      );

      const resp = await this._httpProvider.post<DataResponse<IGetAccountsInfoResponse[]>>({
        url: `${CasperWalletApiUrl[network]}/accounts?includes=account_info,centralized_account_info,cspr_name`,
        data: {
          account_hashes: accountsHashesForFetch,
        },
        headers: CSPR_API_PROXY_HEADERS,
        errorType: 'getAccountsInfo',
      });

      const remoteAccountsInfo =
        resp?.data
          .map(acc => new AccountsInfoDto(acc))
          .reduce<Record<string, IAccountInfo>>(
            (acc, cur) => ({
              ...acc,
              [cur.accountHash]: cur,
            }),
            {},
          ) ?? {};

      Object.entries(remoteAccountsInfo).forEach(([key, accInfo]) => {
        this._accountsInfoMapCache.set(key, accInfo);
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
  }: IGetAccountsInfoParams): Promise<Record<string, ICsprBalance>> {
    try {
      const resp = await this._httpProvider.post<DataResponse<IGetCsprBalanceResponse[]>>({
        url: `${CasperWalletApiUrl[network]}/accounts?includes=delegated_balance,undelegating_balance`,
        data: {
          account_hashes: accountHashes,
        },
        headers: CSPR_API_PROXY_HEADERS,
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

  async resolveAccountFromCsprName(csprName: string): Promise<Maybe<IAccountInfo>> {
    try {
      const resp = await this._httpProvider.get<DataResponse<ICloudResolveFromCsprNameResponse>>({
        url: `https://cspr-wallet-api.dev.make.services:443/cspr-name-resolutions/${csprName}`, // TODO replace with prod version
        params: {
          includes: 'resolved_public_key,account_info,centralized_account_info',
        },
        headers: CSPR_API_PROXY_HEADERS,
        errorType: 'resolveAccountFromCsprName',
      });

      return isExpired(resp?.data?.expires_at)
        ? null
        : new AccountsInfoResolutionFromCsprNameDto(resp?.data);
    } catch (e) {
      if (e instanceof HttpClientNotFoundError) {
        return null;
      }

      this._processError(e, 'resolveAccountFromCsprName');
    }
  }

  private _processError(e: unknown, type: keyof IAccountInfoRepository): never {
    if (isAccountInfoError(e)) {
      throw e;
    }

    throw new AccountInfoError(e, type);
  }
}
