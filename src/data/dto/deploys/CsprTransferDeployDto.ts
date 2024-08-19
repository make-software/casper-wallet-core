import {
  formatTokenBalance,
  getDecimalTokenBalance,
  getUniqueId,
  isKeysEqual,
} from '../../../utils';
import {
  AccountKeyType,
  CSPR_COIN,
  DeployStatus,
  DeployType,
  IAccountInfo,
  INativeCsprDeploy,
  ITransferActionsResult,
} from '../../../domain';
import { getAccountInfoFromMap, getCsprFiatAmount } from './common';
import { Maybe } from '../../../typings';
import { ICsprTransferResponse } from '../../repositories';

/** @deprecated clarity usage */
export class CsprTransferDeployDto implements INativeCsprDeploy {
  constructor(
    activePublicKey: string,
    data?: Partial<ICsprTransferResponse>,
    accountInfoMap: Record<string, IAccountInfo> = {},
  ) {
    this.symbol = CSPR_COIN.symbol;
    this.decimals = CSPR_COIN.decimals;
    this.amount = data?.amount ?? '0';
    this.decimalAmount = getDecimalTokenBalance(this.amount, this.decimals);
    this.formattedDecimalAmount = formatTokenBalance(this.amount, this.decimals);
    this.fiatAmount = getCsprFiatAmount(this.amount, data?.rate);
    this.entryPoint = null;
    this.contractName = null;
    this.type = 'CSPR_NATIVE';
    this.executionTypeId = 6;
    this.status = 'success'; // CSPR transfer cannot have another status

    const callerPublicKey = data?.fromAccountPublicKey ?? data?.fromAccount ?? '';
    const callerKeyType: AccountKeyType = data?.fromAccountPublicKey ? 'publicKey' : 'accountHash';
    this.callerAccountInfo = getAccountInfoFromMap(accountInfoMap, callerPublicKey, callerKeyType);
    this.callerPublicKey = this.callerAccountInfo?.publicKey ?? callerPublicKey;
    this.callerKeyType = this.callerAccountInfo?.publicKey ? 'publicKey' : callerKeyType;

    const recipientKey = data?.toAccountPublicKey ?? data?.toAccount ?? data?.targetPurse ?? '';
    const recipientKeyType = data?.toAccountPublicKey
      ? 'publicKey'
      : data?.toAccount
        ? 'accountHash'
        : data?.targetPurse
          ? 'purse'
          : 'purse';
    this.recipientAccountInfo = getAccountInfoFromMap(
      accountInfoMap,
      recipientKey,
      recipientKeyType,
    );
    this.recipientKey = this.recipientAccountInfo?.publicKey ?? recipientKey;
    this.recipientKeyType = this.recipientAccountInfo?.publicKey ? 'publicKey' : recipientKeyType;

    this.isReceive = isKeysEqual(activePublicKey, this.recipientKey);
    this.contractPackageHash = '';
    this.contractHash = '';
    this.cost = '0';
    this.formattedCost = '0';
    this.fiatCost = '0';
    this.paymentAmount = '0';
    this.formattedPaymentAmount = '0';
    this.fiatPaymentAmount = '0';
    this.timestamp = data?.timestamp ?? '';
    this.errorMessage = null;
    this.transfersActionsResult = [];
    this.deployHash = data?.deployHash ?? '';
    this.id = getUniqueId();
  }

  readonly recipientAccountInfo: Maybe<IAccountInfo>;
  readonly callerKeyType: AccountKeyType;
  readonly callerAccountInfo: Maybe<IAccountInfo>;

  readonly recipientKey: string;
  readonly recipientKeyType: AccountKeyType;
  readonly isReceive: boolean;
  readonly decimals: number;
  readonly symbol: string;
  readonly amount: string;
  readonly decimalAmount: string;
  readonly formattedDecimalAmount: string;
  readonly fiatAmount: string;
  readonly entryPoint: Maybe<string>;
  readonly contractName: Maybe<string>;
  readonly type: DeployType;
  readonly executionTypeId: number;
  readonly contractHash: string;
  readonly contractPackageHash: string;
  readonly status: DeployStatus;
  readonly callerPublicKey: string;
  readonly cost: string;
  readonly formattedCost: string;
  readonly fiatCost: string;
  readonly paymentAmount: string;
  readonly formattedPaymentAmount: string;
  readonly fiatPaymentAmount: string;
  readonly timestamp: string;
  readonly errorMessage: Maybe<string>;
  readonly transfersActionsResult: ITransferActionsResult[];
  readonly id: string;
  readonly deployHash: string;
}
