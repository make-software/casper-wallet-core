import { Maybe } from '../../../typings';

export interface IContractPackageCloudResponse {
  contract_package_hash: string;
  owner_public_key: string;
  name: string;
  description: string;
  metadata: {
    name: string;
    symbol: string;
    decimals: number;
    balances_uref: string;
    total_supply_uref: string;
    ownership_mode: number;
    nft_kind: number;
    nft_metadata_kind: number;
    whitelist_mode: number;
    holder_mode: number;
    minting_mode: number;
    burn_mode: number;
    identifier_mode: number;
    metadata_mutability: number;
    owner_reverse_lookup_mode: number;
    events_mode: number;
  };
  latest_version_contract_type_id: number;
  timestamp: string;
  icon_url: Maybe<string>;
  website_url: Maybe<string>;
  deploys_number: number;
}

export interface IOdraWasmProxyCloud {
  blake2b_hash: string;
  git_commit: string;
  version: string;
}
