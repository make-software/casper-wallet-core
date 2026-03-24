import { formatTokenBalance } from '../../../utils';
import {
  AccountKeyType,
  CSPR_COIN,
  DeployStatus,
  DeployType,
  IAccountInfo,
  ICep18ActionsResult,
  IDeploy,
  INftActionsResult,
  ITransferActionsResult,
  Network,
} from '../../../domain';
import { getCollectionHashFormDeploy, getDeployType, getEntryPoint } from './common';
import { deriveKeyType, getAccountInfoFromMap } from '../common';
import {
  getCep18ActionsResult,
  getNftActionsResult,
  getTransferActionsResult,
} from './ActionResults';
import { ExtendedCloudDeploy, ICloudTransactionFeedItem } from '../../repositories';
import { Maybe } from '../../../typings';
import { getCsprFiatAmount } from '../common';
import Decimal from 'decimal.js';

export class DeployDto implements IDeploy {
  constructor(
    network: Network,
    activePublicKey: string,
    data?: Partial<ExtendedCloudDeploy | ICloudTransactionFeedItem>,
    accountInfoMap: Record<string, IAccountInfo> = {},
  ) {
    this.deployHash = data?.deploy_hash ?? '';
    this.id = this.deployHash;
    this.type = getDeployType(network, data);
    this.executionTypeId = data?.execution_type_id ?? 1;
    this.status = getDeployStatus(data);
    this.errorMessage = data?.error_message ?? null;
    this.timestamp = data?.timestamp ?? '';
    this.cost = getChargedAmount(data);
    this.formattedCost = formatTokenBalance(this.cost, CSPR_COIN.decimals);
    this.fiatCost = getCsprFiatAmount(this.cost, data?.rate);
    this.paymentAmount = data?.payment_amount ?? '0';
    this.formattedPaymentAmount = formatTokenBalance(this.paymentAmount, CSPR_COIN.decimals);
    this.fiatPaymentAmount = getCsprFiatAmount(this.paymentAmount, data?.rate);
    this.contractHash = data?.contract_hash ?? '';
    this.contractPackageHash = data?.contract_package_hash ?? '';
    this.iconUrl = data?.contract_package?.icon_url ?? null;
    this.entryPoint = getEntryPoint(data) ?? null;
    this.contractName = data?.contract_package?.name ?? null;

    const callerPublicKey = data?.caller_public_key ?? '';
    const callerKeyType = deriveKeyType(callerPublicKey);
    this.callerAccountInfo = getAccountInfoFromMap(accountInfoMap, callerPublicKey, callerKeyType);
    this.callerPublicKey = this.callerAccountInfo?.publicKey || callerPublicKey;
    this.callerKeyType = this.callerAccountInfo?.publicKey ? 'publicKey' : callerKeyType;

    this.transfersActionsResult = getTransferActionsResult(activePublicKey, data, accountInfoMap);
    this.cep18ActionsResult = getCep18ActionsResult(activePublicKey, data, accountInfoMap);
    this.nftActionsResult = getNftActionsResult(
      activePublicKey,
      network,
      getCollectionHashFormDeploy(network, this.contractHash, this.contractPackageHash, data),
      data,
      accountInfoMap,
    );
  }

  readonly deployHash: string;
  readonly type: DeployType;
  readonly executionTypeId: number;
  readonly contractHash: string;
  readonly contractPackageHash: string;
  readonly iconUrl: Maybe<string>;
  readonly entryPoint: Maybe<string>;
  readonly status: DeployStatus;
  readonly cost: string;
  readonly formattedCost: string;
  readonly fiatCost: string;
  readonly paymentAmount: string;
  readonly formattedPaymentAmount: string;
  readonly fiatPaymentAmount: string;
  readonly timestamp: string;
  readonly errorMessage: Maybe<string>;
  readonly id: string;
  readonly contractName: Maybe<string>;
  readonly callerPublicKey: string;
  readonly callerKeyType: AccountKeyType;
  readonly callerAccountInfo: Maybe<IAccountInfo>;
  readonly transfersActionsResult: ITransferActionsResult[];
  readonly nftActionsResult: INftActionsResult[];
  readonly cep18ActionsResult: ICep18ActionsResult[];
}

export function getDeployStatus(
  deploy?: Partial<ExtendedCloudDeploy | ICloudTransactionFeedItem>,
): DeployStatus {
  const status = deploy?.status as DeployStatus | undefined;

  if (deploy?.error_message) {
    return 'error';
  }

  if (status && status !== 'executed') {
    return status;
  }

  return 'success';
}

function getChargedAmount(data?: Partial<ExtendedCloudDeploy | ICloudTransactionFeedItem>) {
  if (!data) {
    return '0';
  }

  return new Decimal(data?.payment_amount ?? 0).minus(data?.refund_amount ?? 0).toString();
}
