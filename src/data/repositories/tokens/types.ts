import { DataResponse, Network } from '../../../domain';
import { Maybe } from '../../../typings';

export interface IGetCsprBalanceResponse {
  balance: number;
  delegated_balance?: number;
  undelegating_balance?: number;

  public_key?: string;
  account_hash?: string;
  main_purse_uref?: string;
}

export type IGetCurrencyRateResponse = DataResponse<{
  currency_id: number;
  amount: number;
  created: string;
}>;

export interface Erc20Token {
  balance: string;
  contract_package_hash: string;
  owner_hash: string;
  owner_type: number;
  coingecko_data?: Maybe<CoingeckoApiData>;
  friendlymarket_data?: Maybe<FriendlymarketApiData>;
  contract_package: ContractPackage;
}

export interface CoingeckoApiData {
  price: number;
  change_24h: number;
  volume_24h: number;
}

export interface FriendlymarketApiData {
  price: number;
  volume_24h: number;
}

export interface ContractPackage {
  description: string | null;
  name: string;
  contract_package_hash: string;
  contract_type_id: number;
  icon_url: string | null;
  metadata: {
    balances_uref: string;
    decimals: number;
    name: string;
    symbol: string;
    total_supply_uref: string;
  };
  owner_public_key: string;
  timestamp: string;
  contractHash?: string;
  coingecko_id?: string | null;
  friendlymarket_id?: string | null;
  coingecko_data?: Maybe<CoingeckoApiData>;
  friendlymarket_data?: Maybe<FriendlymarketApiData>;
  latest_version_contract_hash?: string | null;
}

export interface ApiToken extends ContractPackage {
  balance: string;
  network: Network;
  contractHash?: string;
  coingecko_data?: Maybe<CoingeckoApiData>;
  friendlymarket_data?: Maybe<FriendlymarketApiData>;
}
