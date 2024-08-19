import { formatTokenBalance, getDecimalTokenBalance, isKeysEqual } from '../../../utils';
import {
  AccountKeyType,
  CSPR_COIN,
  IAccountInfo,
  INativeCsprDeploy,
  Network,
} from '../../../domain';
import {
  derivePublicKeyFromTransfersActionResults,
  getAccountInfoFromMap,
  getCsprFiatAmount,
  getDeployAmount,
} from './common';
import { DeployDto } from './DeployDto';
import { ExtendedCloudDeploy } from '../../repositories';
import { Maybe } from '../../../typings';

export class NativeCsprDeployDto extends DeployDto implements INativeCsprDeploy {
  constructor(
    network: Network,
    activePublicKey: string,
    data?: Partial<ExtendedCloudDeploy>,
    accountInfoMap: Record<string, IAccountInfo> = {},
  ) {
    super(network, activePublicKey, data, accountInfoMap);
    const { recipientKey, recipientKeyType } = getNativeTransferRecipientKey(data);
    this.recipientAccountInfo = getAccountInfoFromMap(
      accountInfoMap,
      recipientKey,
      recipientKeyType,
    );
    this.recipientKey = this.recipientAccountInfo?.publicKey ?? recipientKey;
    this.recipientKeyType = this.recipientAccountInfo?.publicKey ? 'publicKey' : recipientKeyType;
    this.isReceive = isKeysEqual(activePublicKey, this.recipientKey);
    this.decimals = CSPR_COIN.decimals;
    this.symbol = CSPR_COIN.symbol;
    this.amount = getDeployAmount(data?.args);
    this.decimalAmount = getDecimalTokenBalance(this.amount, this.decimals);
    this.formattedDecimalAmount = formatTokenBalance(this.amount, this.decimals);
    this.entryPoint = null;
    this.contractName = null;
    this.fiatAmount = getCsprFiatAmount(
      this.amount,
      data?.time_transaction_currency_rate ?? data?.rate,
    );
  }

  readonly entryPoint: Maybe<string>;
  readonly contractName: Maybe<string>;
  readonly recipientKey: string;
  readonly recipientKeyType: AccountKeyType;
  readonly recipientAccountInfo: Maybe<IAccountInfo>;
  readonly isReceive: boolean;
  readonly amount: string;
  readonly decimalAmount: string;
  readonly formattedDecimalAmount: string;
  readonly symbol: string;
  readonly decimals: number;
  readonly fiatAmount: string;
}

function getNativeTransferRecipientKey(
  data?: Partial<ExtendedCloudDeploy>,
): Pick<INativeCsprDeploy, 'recipientKey' | 'recipientKeyType'> {
  const recipientKeyType: AccountKeyType =
    data?.args?.target?.cl_type === 'PublicKey' ? 'publicKey' : 'accountHash';
  const recipientKey = String(data?.args?.target?.parsed ?? '');

  if (recipientKeyType === 'accountHash') {
    const publicKey = derivePublicKeyFromTransfersActionResults(recipientKey, data);

    if (publicKey) {
      return {
        recipientKey: publicKey,
        recipientKeyType,
      };
    }
  }

  return {
    recipientKey,
    recipientKeyType,
  };
}
