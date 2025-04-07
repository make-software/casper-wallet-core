import { Maybe } from '../../../typings';
import { ContractPackage } from '../tokens';

export enum TransactorHashType {
  'account' = 0,
  'hash' = 1,
}

export interface MessageDataAccount {
  accountHash?: string;
  publicKey?: string;
  hash?: string;
  logo?: string;
  path?: string;
  hashType?: TransactorHashType;
}

export interface MessageData {
  entryPointName?: string | null;
  actionName?: string;
  numOfTokens?: number;
  numOfTokensPrefix?: string | null;
  symbol?: string;
  callerPrefix?: string;
  callerAccount?: MessageDataAccount;
  prefix1?: string;
  account1?: MessageDataAccount;
  prefix2?: string;
  account2?: MessageDataAccount;
  nftTokenIds?: string[] | null;
  contractPrefix?: string;
  amount?: string;
}

export type ExtendedDeployArgsResult = {
  amount?: ExtendedDeployClTypeResult;
  spender?: ExtendedDeployClTypeResult;
  bsc_recipient_address?: ExtendedDeployClTypeResult;
  contract_hash_str?: ExtendedDeployClTypeResult;
  recipient?: ExtendedDeployClTypeResult;
  owner?: ExtendedDeployClTypeResult;
  token_id?: ExtendedDeployClTypeResult;
  token_meta?: ExtendedDeployClTypeResult;
  token_metas?: ExtendedDeployClTypeResult;
  token_meta_data?: ExtendedDeployClTypeResult;
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
  tokens?: ExtendedDeployClTypeResult;
  delegator?: ExtendedDeployClTypeResult;
  validator?: ExtendedDeployClTypeResult;
  new_validator?: ExtendedDeployClTypeResult;
  offerer?: ExtendedDeployClTypeResult;
  collection?: ExtendedDeployClTypeResult;
  token_owner?: ExtendedDeployClTypeResult;
  operator?: ExtendedDeployClTypeResult;
  token_ids?: ExtendedDeployClTypeResult;
  target_key?: ExtendedDeployClTypeResult;
  source_key?: ExtendedDeployClTypeResult;
};

export enum FTEntryPointType {
  approve = 'approve',
  mint = 'mint',
  burn = 'burn',
  transfer = 'transfer',
}

export type DeployTransferResult = {
  amount: string;
  block_height: number;
  deploy_hash: string;
  from_purse_public_key: string | null;
  from_purse: string;
  id: string | null;
  initiator_account_hash: string;
  timestamp: string;
  to_account_hash: string;
  to_purse: string;
  transform_key: string;
  to_purse_public_key: string | null;
};

export type NftCloudActionsResult = {
  block_height: number;
  contract_package: ExtendedDeployContractPackageResult;
  contract_package_hash: string;
  deploy_hash: string;
  from_hash: null;
  from_public_key: string | null;
  from_type: null;
  nft_action_id: number;
  timestamp: string;
  to_hash: string;
  to_public_key: string | null;
  to_type: number;
  token_id: string;
  token_tracking_id: number;
};

export type FTActionsResult = {
  amount: string;
  contract_package: ExtendedDeployContractPackageResult;
  contract_package_hash: string;
  deploy_hash: string;
  ft_action_type_id: number;
  from_hash: string;
  from_public_key: string | null;
  from_type: TransactorHashType;
  timestamp: string;
  to_hash: string;
  to_public_key: string | null;
  to_type: TransactorHashType;
};

export interface ExtendedCloudDeploy {
  // means it's a pending deploy
  pending?: boolean;
  amount: string | null;
  args: ExtendedDeployArgsResult;
  blockHash: string | null;
  caller_public_key: string;
  contract_hash: string | null;
  contract_package_hash: string | null;
  cost: string;
  consumed_gas: string;
  deploy_hash: string;
  error_message: string | null;
  payment_amount: string | null;
  status: string;
  timestamp: string;
  entry_point?: ExtendedDeployEntryPointResult;
  contract_entrypoint?: ExtendedDeployEntryPointResult;
  contract_package: ExtendedDeployContractPackageResult;
  execution_type_id: number;
  time_transaction_currency_rate: number;
  rate: number;
  transfers?: DeployTransferResult[];
  ft_token_actions?: FTActionsResult[];
  nft_token_actions?: NftCloudActionsResult[];
}

export enum CasperMarketEntryPoint {
  delist_token = 'delist_token',
  list_token = 'list_token',
  accept_offer = 'accept_offer',
  cancel_offer = 'cancel_offer',
  make_offer = 'make_offer',
}

export enum CasperAssociatedKeysEntryPoint {
  set_associated_keys = 'set_associated_keys',
}

export enum AuctionEntryPoint {
  add_bid = 'add_bid',
  withdraw_bid = 'withdraw_bid',
  activate_bid = 'activate_bid',
  delegate = 'delegate',
  undelegate = 'undelegate',
  redelegate = 'redelegate',
}

export enum NftTokenEntryPoint {
  approve = 'approve',
  burn = 'burn',
  mint = 'mint',
  transfer = 'transfer',
  update_token_meta = 'update_token_meta',
  set_approval_for_all = 'set_approval_for_all',
}

export interface AccountInfoResult {
  account_hash: string;
  url: string;
  is_active: boolean;
  deploy_hash: string;
  verified_account_hashes: string[];
  info?: {
    owner?: AccountInfoOwner;
    nodes?: Array<AccountInfoNode>;
  };
}

export interface AccountInfoOwner {
  name?: string;
  description?: string;
  type?: Array<string>;
  email?: string;
  identity?: {
    ownership_disclosure_url?: string;
    casper_association_kyc_url?: string;
    casper_association_kyc_onchain?: string;
  };
  resources?: {
    code_of_conduct_url?: string;
    terms_of_service_url?: string;
    privacy_policy_url?: string;
    other?: Array<{
      name?: string;
      url?: string;
    }>;
  };
  affiliated_accounts?: Array<AccountInfoAffiliatedAccount>;
  website?: string;
  branding?: {
    logo?: {
      svg?: string;
      png_256?: string;
      png_1024?: string;
    };
  };
  location?: {
    name?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  };
  social?: {
    github?: string;
    medium?: string;
    reddit?: string;
    wechat?: string;
    keybase?: string;
    twitter?: string;
    youtube?: string;
    facebook?: string;
    telegram?: string;
  };
}

export interface AccountInfoNode {
  public_key?: string;
  description?: string;
  functionality?: string[];
  location?: {
    name?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  };
}

export interface AccountInfoAffiliatedAccount {
  public_key?: string;
}

export interface ICsprTransferResponse {
  amount: string;
  deploy_hash: string;
  from_purse: string;
  from_purse_public_key: string;
  initiator_account_hash: string;
  initiator_public_key: string;
  to_account_hash: string;
  to_public_key: string;
  to_purse_public_key: string;
  to_purse: string;
  id: number;
  timestamp: string;
  rate?: number;
  transform_key: string;
  deploy: ExtendedCloudDeploy;
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
  block_height: number;
  ft_action_type_id: number;
  transform_idx: number;
  deploy?: ExtendedCloudDeploy;
  contract_package?: ContractPackage;
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
