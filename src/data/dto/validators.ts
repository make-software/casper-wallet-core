import {
  formatAddress,
  formatTokenBalance,
  getDecimalTokenBalance,
  getUniqueId,
} from '../../utils';
import { CSPR_DECIMALS, IValidator } from '../../domain';
import { IApiValidator, IApiValidatorWithStake } from '../repositories';
import { Maybe } from '../../typings';
import {
  DEFAULT_MAXIMUM_DELEGATION_AMOUNT,
  DEFAULT_MINIMUM_DELEGATION_AMOUNT,
} from 'casper-js-sdk';
import Decimal from 'decimal.js';

export class ValidatorDto implements IValidator {
  constructor(apiValidator?: Partial<IApiValidator>) {
    this.id = apiValidator?.public_key ?? getUniqueId();
    this.publicKey = apiValidator?.public_key ?? '';
    this.name = apiValidator?.account_info?.info?.owner?.name ?? formatAddress(this.publicKey);
    this.delegatorsNumber = apiValidator?.delegators_number ?? 0;
    this.totalStake = apiValidator?.total_stake ?? '0';
    this.formattedTotalStake = formatTokenBalance(this.totalStake, CSPR_DECIMALS, 0);
    this.fee = `${apiValidator?.fee ?? '0'}`;
    this.svgLogo = apiValidator?.account_info?.info?.owner?.branding?.logo?.svg;
    this.imgLogo =
      apiValidator?.account_info?.info?.owner?.branding?.logo?.png_256 ??
      apiValidator?.account_info?.info?.owner?.branding?.logo?.png_1024;

    this.minAmount = getMinAmount(apiValidator?.minimum_delegation_amount);
    this.maxAmount = getMaxAmount(apiValidator?.maximum_delegation_amount);
    this.reservedSlots = apiValidator?.reserved_slots ?? 0;
  }

  id: string;
  publicKey: string;
  name: string;
  delegatorsNumber: number;
  totalStake: string;
  formattedTotalStake: string;
  stake: Maybe<string> = null;
  decimalStake: Maybe<string> = null;
  formattedDecimalStake: Maybe<string> = null;
  fee: string;
  svgLogo?: string;
  imgLogo?: string;
  minAmount: string;
  maxAmount: string;
  reservedSlots: number;
}

export class ValidatorWithStateDto implements IValidator {
  constructor(apiValidator?: Partial<IApiValidatorWithStake>) {
    this.id = apiValidator?.bidder?.public_key ?? getUniqueId();
    this.publicKey = apiValidator?.bidder?.public_key ?? '';
    this.name =
      apiValidator?.validator_account_info?.info?.owner?.name ?? formatAddress(this.publicKey);
    this.delegatorsNumber = apiValidator?.bidder?.delegators_number ?? 0;
    this.totalStake = apiValidator?.bidder?.total_stake?.toString() ?? '0';
    this.formattedTotalStake = formatTokenBalance(this.totalStake, CSPR_DECIMALS, 0);
    this.stake = apiValidator?.stake ?? null;
    this.decimalStake = this.stake ? getDecimalTokenBalance(this.stake, CSPR_DECIMALS) : null;
    this.formattedDecimalStake = this.stake ? formatTokenBalance(this.stake, CSPR_DECIMALS) : null;
    this.fee = `${apiValidator?.bidder?.fee ?? '0'}`;
    this.svgLogo = apiValidator?.validator_account_info?.info?.owner?.branding?.logo?.svg;
    this.imgLogo =
      apiValidator?.validator_account_info?.info?.owner?.branding?.logo?.png_256 ??
      apiValidator?.validator_account_info?.info?.owner?.branding?.logo?.png_1024;

    this.minAmount = getMinAmount(apiValidator?.bidder?.minimum_delegation_amount);
    this.maxAmount = getMaxAmount(apiValidator?.bidder?.maximum_delegation_amount);
    this.reservedSlots = apiValidator?.bidder?.reserved_slots ?? 0;
  }

  id: string;
  publicKey: string;
  name: string;
  delegatorsNumber: number;
  totalStake: string;
  formattedTotalStake: string;
  stake: Maybe<string>;
  decimalStake: Maybe<string>;
  formattedDecimalStake: Maybe<string>;
  fee: string;
  svgLogo?: string;
  imgLogo?: string;
  minAmount: string;
  maxAmount: string;
  reservedSlots: number;
}

function getMinAmount(minAmount?: string) {
  if (!minAmount) {
    return DEFAULT_MINIMUM_DELEGATION_AMOUNT.toString();
  }

  return minAmount && new Decimal(minAmount).gte(DEFAULT_MINIMUM_DELEGATION_AMOUNT.toString())
    ? minAmount
    : DEFAULT_MINIMUM_DELEGATION_AMOUNT.toString();
}

function getMaxAmount(maxAmount?: string) {
  if (!maxAmount) {
    return DEFAULT_MAXIMUM_DELEGATION_AMOUNT.toString();
  }

  return maxAmount;
}
