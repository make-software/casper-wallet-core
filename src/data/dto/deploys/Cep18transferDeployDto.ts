import {
  formatTokenBalance,
  getDecimalTokenBalance,
  getUniqueId,
  isKeysEqual,
} from '../../../utils';
import {
  AccountKeyType,
  CEP18EntryPointType,
  CSPR_COIN,
  DeployStatus,
  DeployType,
  IAccountInfo,
  ICep18ActionsResult,
  ICep18Deploy,
  INftActionsResult,
  ITransferActionsResult,
} from '../../../domain';

import { getAccountInfoFromMap, getCsprFiatAmount } from './common';
import { Maybe } from '../../../typings';
import { IErc20TokensTransferResponse } from '../../repositories';

/** @deprecated clarity usage */
export class Cep18TransferDeployDto implements ICep18Deploy {
  constructor(
    activePublicKey: string,
    data?: Partial<IErc20TokensTransferResponse>,
    accountInfoMap: Record<string, IAccountInfo> = {},
  ) {
    this.id = getUniqueId();
    this.deployHash = data?.deploy_hash ?? '';
    this.executionTypeId = data?.deploy?.execution_type_id ?? 1;
    this.contractHash = data?.contract_package?.contractHash ?? '';
    this.contractPackageHash = data?.contract_package?.contract_package_hash ?? '';
    this.status = 'success'; // transfer cannot have another status
    this.type = 'CEP18';
    this.entryPoint = FTActionType[data?.erc20_action_type_id ?? 2];
    this.contractName = data?.contract_package?.contract_name ?? '';
    this.iconUrl = data?.contract_package?.icon_url ?? null;
    this.cep18ActionsResult = [];
    this.transfersActionsResult = [];

    const recipientKey = data?.to_public_key ?? data?.to_hash ?? '';
    const recipientKeyType = data?.to_public_key ? 'publicKey' : 'accountHash';
    this.recipientAccountInfo = getAccountInfoFromMap(
      accountInfoMap,
      recipientKey,
      recipientKeyType,
    );
    this.recipientKey = this.recipientAccountInfo?.publicKey ?? recipientKey;
    this.recipientKeyType = this.recipientAccountInfo?.publicKey ? 'publicKey' : recipientKeyType;
    this.isReceive = isKeysEqual(activePublicKey, this.recipientKey);

    const callerPublicKey = data?.from_public_key ?? data?.from_hash ?? '';
    const callerKeyType = data?.from_public_key ? 'publicKey' : 'accountHash';
    this.callerAccountInfo = getAccountInfoFromMap(accountInfoMap, callerPublicKey, callerKeyType);
    this.callerPublicKey = this.callerAccountInfo?.publicKey ?? callerPublicKey;
    this.callerKeyType = this.callerAccountInfo?.publicKey ? 'publicKey' : callerKeyType;

    this.symbol = data?.contract_package?.metadata?.symbol ?? '';
    this.decimals = data?.contract_package?.metadata?.decimals ?? 0;
    this.amount = data?.amount ?? '0';
    this.decimalAmount = getDecimalTokenBalance(this.amount, this.decimals);
    this.formattedDecimalAmount = formatTokenBalance(this.amount, this.decimals);

    this.errorMessage = data?.deploy?.error_message ?? null;
    this.timestamp = data?.timestamp ?? '';

    this.cost = data?.deploy?.cost ?? '0';
    this.formattedCost = formatTokenBalance(this.cost, CSPR_COIN.decimals);
    this.fiatCost = getCsprFiatAmount(this.cost, data?.deploy?.rate);
    this.paymentAmount = data?.deploy?.payment_amount ?? '0';
    this.formattedPaymentAmount = formatTokenBalance(this.paymentAmount, CSPR_COIN.decimals);
    this.fiatPaymentAmount = getCsprFiatAmount(this.paymentAmount, data?.deploy?.rate);
    this.fiatAmount = '';
    this.nftActionsResult = [];
  }

  readonly entryPoint: CEP18EntryPointType;
  readonly contractName: string;
  readonly iconUrl: Maybe<string>;
  readonly cep18ActionsResult: ICep18ActionsResult[];
  readonly nftActionsResult: INftActionsResult[];
  readonly recipientKey: string;
  readonly recipientKeyType: AccountKeyType;
  readonly recipientAccountInfo: Maybe<IAccountInfo>;
  readonly isReceive: boolean;
  readonly decimals: number;
  readonly symbol: string;
  readonly amount: string;
  readonly decimalAmount: string;
  readonly formattedDecimalAmount: string;
  readonly fiatAmount: string;
  readonly deployHash: string;
  readonly type: DeployType;
  readonly executionTypeId: number;
  readonly contractHash: string;
  readonly contractPackageHash: string;
  readonly status: DeployStatus;
  readonly callerPublicKey: string;
  readonly callerKeyType: AccountKeyType;
  readonly callerAccountInfo: Maybe<IAccountInfo>;
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
}

export const FTActionType: Record<number, CEP18EntryPointType> = {
  1: 'mint',
  2: 'transfer',
  3: 'approve',
  4: 'burn',
};
