import { Maybe } from '../../../typings';

export interface IGetAccountsInfoResponse {
  account_hash: string;
  balance: number;
  main_purse_uref: string;
  public_key: string;
  account_info?: ICloudAccountInfoResult;
  centralized_account_info?: CloudCentralizedAccountInfo;
}

export interface ICloudAccountInfoResult {
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

interface AccountInfoOwner {
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

interface AccountInfoNode {
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

interface AccountInfoAffiliatedAccount {
  public_key?: string;
}

export interface CloudCentralizedAccountInfo {
  account_hash: string;
  avatar_url: Maybe<string>;
  name: string;
  url: Maybe<string>;
}
