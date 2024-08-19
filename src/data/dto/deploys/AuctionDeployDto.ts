import {
  AccountKeyType,
  AuctionEntryPointType,
  CSPR_COIN,
  IAccountInfo,
  IAuctionDeploy,
  Network,
} from '../../../domain';
import {
  deriveKeyType,
  getAccountInfoFromMap,
  getCsprFiatAmount,
  getDeployAmount,
  getEntryPoint,
} from './common';
import { formatTokenBalance, getDecimalTokenBalance } from '../../../utils';
import { DeployDto } from './DeployDto';
import { ExtendedCloudDeploy } from '../../repositories';
import { Maybe } from '../../../typings';

export class AuctionDeployDto extends DeployDto implements IAuctionDeploy {
  constructor(
    network: Network,
    activePublicKey: string,
    data?: Partial<ExtendedCloudDeploy>,
    accountInfoMap: Record<string, IAccountInfo> = {},
  ) {
    super(network, activePublicKey, data, accountInfoMap);
    this.contractName = data?.contract_package?.name ?? '';
    this.entryPoint = (getEntryPoint(data) ?? 'delegate') as AuctionEntryPointType;
    this.decimals = CSPR_COIN.decimals;
    this.symbol = CSPR_COIN.symbol;
    this.amount = getDeployAmount(data?.args);
    this.decimalAmount = getDecimalTokenBalance(this.amount, this.decimals);
    this.formattedDecimalAmount = formatTokenBalance(this.amount, this.decimals);
    this.fiatAmount = getCsprFiatAmount(
      this.amount,
      data?.time_transaction_currency_rate ?? data?.rate,
    );

    const fromValidator = getFromValidator(data);
    const fromValidatorKeyType = deriveKeyType(fromValidator);
    this.fromValidatorAccountInfo = getAccountInfoFromMap(
      accountInfoMap,
      fromValidator,
      fromValidatorKeyType,
    );
    this.fromValidator = this.fromValidatorAccountInfo?.publicKey ?? fromValidator;
    this.fromValidatorKeyType = this.fromValidatorAccountInfo?.publicKey
      ? 'publicKey'
      : fromValidatorKeyType;

    const toValidator = getToValidator(data);
    const toValidatorKeyType = deriveKeyType(toValidator);
    this.toValidatorAccountInfo = getAccountInfoFromMap(
      accountInfoMap,
      toValidator,
      toValidatorKeyType,
    );
    this.toValidator = this.toValidatorAccountInfo?.publicKey ?? toValidator;
    this.toValidatorKeyType = this.toValidatorAccountInfo?.publicKey
      ? 'publicKey'
      : toValidatorKeyType;
  }

  readonly entryPoint: AuctionEntryPointType;
  readonly fromValidator: Maybe<string>;
  readonly fromValidatorKeyType: AccountKeyType;
  readonly fromValidatorAccountInfo: Maybe<IAccountInfo>;
  readonly toValidator: Maybe<string>;
  readonly toValidatorKeyType: AccountKeyType;
  readonly toValidatorAccountInfo: Maybe<IAccountInfo>;
  readonly contractName: string;

  readonly decimals: number;
  readonly symbol: string;
  readonly amount: string;
  readonly decimalAmount: string;
  readonly formattedDecimalAmount: string;
  readonly fiatAmount: string;
}

function getFromValidator(data?: Partial<ExtendedCloudDeploy>): string | null {
  const entryPoint = getEntryPoint(data);

  if (entryPoint === 'undelegate' && data?.args?.validator?.cl_type === 'PublicKey') {
    return String(data?.args?.validator?.parsed);
  } else if (entryPoint === 'redelegate' && data?.args?.validator?.cl_type === 'PublicKey') {
    return String(data?.args?.validator?.parsed);
  }

  return null;
}

function getToValidator(data?: Partial<ExtendedCloudDeploy>) {
  const entryPoint = getEntryPoint(data);

  if (data?.args?.new_validator) {
    return data?.args?.new_validator.cl_type === 'PublicKey'
      ? String(data?.args?.new_validator.parsed)
      : '';
  } else if (data?.args?.validator && entryPoint !== 'undelegate') {
    return data?.args?.validator.cl_type === 'PublicKey'
      ? String(data?.args?.validator.parsed)
      : '';
  } else if (entryPoint === 'undelegate') {
    return data?.caller_public_key ?? '';
  }

  return null;
}
