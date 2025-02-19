import { ICloudAccountInfoResult } from '../accountInfo';

export interface IApiValidator {
  fee: number | string;
  is_active: boolean;
  self_stake: string;
  bid_amount: string;
  total_stake: string;
  self_share: string;
  public_key: string;
  network_share: string;
  era_id: number;
  delegators_number: number;
  delegators_stake: number;
  rank: number;
  average_performance?: IValidatorAveragePerformance;
  account_info?: IValidatorAccountInfo;
  maximum_delegation_amount?: string; // '1000000000000000000';
  minimum_delegation_amount?: string; // '500000000000';
  reserved_slots?: number;
}

export interface IValidatorAveragePerformance {
  era_id: number;
  public_key: string;
  average_score: number; // between 0 and 100, treat it as percentage
}

export interface IValidatorAccountInfo {
  account_hash: string;
  url: string;
  is_active: boolean;
  deploy_hash: string;
  verified_account_hashes: string[];
  info?: {
    owner?: IValidatorAccountInfoOwner;
    nodes?: Array<IValidatorAccountInfoNode>;
  };
}

export interface IValidatorAccountInfoOwner {
  name?: string;
  description?: string;
  type?: Array<string>;
  email?: string;
  identity?: {
    ownership_disclosure_url?: string;
    casper_association_kyc_url?: string;
    casper_association_kyc_onchain?: string;
    other?: string | number;
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
  affiliated_accounts?: Array<IValidatorAccountInfoAffiliatedAccount>;
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

export interface IValidatorAccountInfoAffiliatedAccount {
  public_key?: string;
}

export interface IValidatorAccountInfoNode {
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

export interface IApiValidatorWithStake {
  validator_public_key: string;
  public_key: string;
  stake: string;
  bonding_purse: string;
  /** delegator */
  account_info?: ICloudAccountInfoResult;
  validator_account_info?: ICloudAccountInfoResult;
  bidder: IApiBidder;
}

export interface IApiBidder {
  delegators_number: number;
  delegators_stake: number;
  era_id: number;
  fee: number;
  is_active: boolean;
  network_share: string;
  public_key: string;
  rank: number;
  self_share: string;
  self_stake: number;
  total_stake: number;
  maximum_delegation_amount?: string; // '1000000000000000000';
  minimum_delegation_amount?: string; // '500000000000';
  reserved_slots?: number;
}

export interface IAuctionMetricsResponse {
  active_bids_number: number;
  active_validator_number: number;
  current_era_id: number;
  total_active_era_stake: string;
  total_bids_number: number;
}
