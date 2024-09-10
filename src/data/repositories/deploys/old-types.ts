import { Maybe } from '../../../typings';
import { DeployType } from '../../../domain';
import { ContractPackage } from '../tokens';

export interface ICsprTransferResponse {
  amount: string;
  blockHash: string;
  deployHash: string;
  fromAccount: string;
  fromAccountPublicKey: string;
  toAccount: Maybe<string>;
  toAccountPublicKey: string;
  transferId: string;
  timestamp: string;
  targetPurse: string;
  rate?: number;
}

export interface IErc20TokensTransferResponse {
  deploy_hash: string;
  contract_package_hash: string;
  from_type: Maybe<string>;
  from_hash: Maybe<string>;
  from_public_key?: Maybe<string>;
  to_type: Maybe<string | 'account-hash'>;
  to_hash: Maybe<string>;
  to_public_key?: string;
  erc20_action_type_id: number;
  amount: string;
  timestamp: string;
  deploy?: IApiErc20Deploy;
  contract_package?: ContractPackage;
}

export interface IApiDeploy {
  pending?: boolean;
  amount: Maybe<string>;
  args: IApiDeployArgs;
  block_hash: Maybe<string>;
  caller_public_key: string;
  contract_hash: Maybe<string>;
  contract_package_hash: Maybe<string>;
  cost: string;
  currency_cost: number;
  deploy_hash: string;
  error_message: Maybe<string>;
  payment_amount: Maybe<string>;
  status: string;
  timestamp: string;
  entry_point?: ExtendedDeployEntryPointResult;
  contract_package?: ExtendedDeployContractPackageResult;
  execution_type_id: 1 | 2 | 3 | 4 | 5 | 6;
  rate: number;
}

export type ApiExecutionType = DeployType | 'transfer';

export interface IApiErc20Deploy {
  deploy_hash: string;
  block_hash: string;
  caller_public_key: string;
  execution_type_id: number;
  contract_hash: string;
  contract_package_hash: string;
  cost: string;
  payment_amount: string;
  error_message: Maybe<string>;
  timestamp: string;
  status: string;
  args: IApiDeployArgs;
  amount?: string;
  currency_cost: number;
  rate: number;
  current_currency_cost: number;
}

export interface IApiDeployArgs {
  amount?: ExtendedDeployClTypeResult;
  spender?: ExtendedDeployClTypeResult;
  bsc_recipient_address?: ExtendedDeployClTypeResult;
  contract_hash_str?: ExtendedDeployClTypeResult;
  recipient?: ExtendedDeployClTypeResult;
  token_id?: ExtendedDeployClTypeResult;
  token_ids?: ExtendedDeployClTypeResult;
  token_meta?: ExtendedDeployClTypeResult;
  id?: ExtendedDeployClTypeResult;
  target?: ExtendedDeployClTypeResult;
  contract_name?: ExtendedDeployClTypeResult;
  decimals?: ExtendedDeployClTypeResult;
  initial_supply?: ExtendedDeployClTypeResult;
  name?: ExtendedDeployClTypeResult;
  symbol?: ExtendedDeployClTypeResult;
  amount_in?: ExtendedDeployClTypeResult;
  amount_out_min?: ExtendedDeployClTypeResult;
  deadline?: ExtendedDeployClTypeResult;
  path?: ExtendedDeployClTypeResult;
  to?: ExtendedDeployClTypeResult;
  validator?: ExtendedDeployClTypeResult;
  new_validator?: ExtendedDeployClTypeResult;
}

export interface ExtendedDeployClTypeResult {
  cl_type: CLTypeTypeResult;
  parsed: CLTypeParsedResult | Maybe<string>;
}

type CLTypeTypeResult = CLTypeMapResult | CLTypeOptionResult | string;

type CLTypeParsedResult =
  | CLTypeParsedListResult
  | CLTypeParsedAccountResult
  | CLTypeMapParsedResult
  | CLTypeParsedHashResult
  | string
  | number;

export interface CLTypeMapResult {
  Map: {
    key: string;
    value: string;
  };
}

export interface CLTypeMapParsedResult {
  key: string;
  value: string;
}

export interface CLTypeOptionResult {
  Option: string;
}

export interface CLTypeParsedAccountResult {
  Account: string;
}
export interface CLTypeParsedHashResult {
  Hash: string;
}

type CLTypeParsedListResult = (CLTypeMapParsedResult | string)[];

export interface ExtendedDeployContractPackageResult {
  contract_description: Maybe<string>;
  name: Maybe<string>;
  contract_package_hash: string;
  contract_type_id: Maybe<number>;
  owner_public_key: Maybe<string>;
  timestamp: string;
  deploys_num?: number;
  metadata?: ExtendedDeployContractPackageMetadata;
  icon_url?: string;
  latest_version_contract_type_id?: number;
}

export interface ExtendedDeployEntryPointResult {
  action_type_id: null;
  contract_hash: Maybe<string>;
  contract_package_hash: Maybe<string>;
  id: Maybe<string>;
  name: Maybe<string>;
}

export interface ExtendedDeployContractPackageMetadata {
  symbol: string;
  decimals: number;
  balances_uref: string;
  total_supply_uref: string;
  burn_mode?: string;
  holder_mode?: string;
  identifier_mode?: string;
  metadata_mutability?: string;
  minting_mode?: string;
  nft_kind?: string;
  nft_metadata_kind?: string;
  ownership_mode?: string;
  whitelist_mode?: string;
  owner_reverse_lookup_mode?: string;
}
