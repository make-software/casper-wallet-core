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
} from '../../../domain';
import type { IHttpDataProvider } from '../../../domain';
import { AccountsInfoDto } from '../../dto';
import { IGetAccountsInfoResponse } from './types';

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
        url: `${CasperWalletApiUrl[network]}/accounts?includes=account_info,centralized_account_info`,
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

  private _processError(e: unknown, type: keyof IAccountInfoRepository): never {
    if (isAccountInfoError(e)) {
      throw e;
    }

    throw new AccountInfoError(e, type);
  }
}
