import { Network } from '../../../domain';

export interface IGetCsprBalanceResponse {
  balance: number;
  delegated_balance?: number;
  undelegating_balance?: number;

  public_key?: string;
  account_hash?: string;
  main_purse_uref?: string;
}

export interface IGetCurrencyRateResponse {
  data: number;
}

export interface Erc20Token {
  account_hash: string;
  balance: string;
  contract_package_hash: string;
  latest_contract?: {
    contract_hash: string;
    contract_package_hash: string;
    deploy_hash: string;
    contract_type_id: number;
    contract_version: number;
    is_disabled: boolean;
    protocol_version: string;
    timestamp: string;
  };
  contract_package: ContractPackage;
}

export interface ContractPackage {
  contract_description: string | null;
  contract_name: string;
  contract_package_hash: string;
  contract_type_id: number;
  icon_url: string | null;
  metadata: {
    balances_uref: string;
    decimals: number;
    symbol: string;
    total_supply_uref: string;
  };
  owner_public_key: string;
  timestamp: string;
  contractHash?: string;
}

export interface ApiToken extends ContractPackage {
  balance: string;
  network: Network;
  contractHash?: string;
}
