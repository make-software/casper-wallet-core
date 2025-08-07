import { getDeployAmount, getEntryPoint, guardedDeriveSplitDataFromArguments } from './common';
import {
  formatTokenBalance,
  getAccountHashFromPublicKey,
  getCep18FiatAmount,
  getDecimalTokenBalance,
  isKeysEqual,
  isNotEmpty,
} from '../../../utils';
import { DeployDto } from './DeployDto';
import { ExtendedCloudDeploy } from '../../repositories';
import {
  AccountKeyType,
  CEP18EntryPointType,
  IAccountInfo,
  ICep18Deploy,
  Network,
  SupportedMarketDataProviders,
} from '../../../domain';
import { Maybe } from '../../../typings';
import { getAccountInfoFromMap, getMarketDataProviderUrl } from '../common';

export class Cep18DeployDto extends DeployDto implements ICep18Deploy {
  constructor(
    network: Network,
    activePublicKey: string,
    data?: Partial<ExtendedCloudDeploy>,
    accountInfoMap: Record<string, IAccountInfo> = {},
  ) {
    super(network, activePublicKey, data, accountInfoMap);
    this.entryPoint = (getEntryPoint(data) ?? 'transfer') as CEP18EntryPointType;
    this.contractName = data?.contract_package?.name ?? '';
    this.symbol = data?.contract_package?.metadata?.symbol ?? '';
    this.decimals = data?.contract_package?.metadata?.decimals ?? 0;
    this.amount = getDeployAmount(data?.args);
    this.decimalAmount = getDecimalTokenBalance(this.amount, this.decimals);
    this.formattedDecimalAmount = formatTokenBalance(this.amount, this.decimals);
    this.iconUrl = data?.contract_package?.icon_url ?? null;
    const { recipientKey, recipientKeyType } = getCep18RecipientKeyAndType(data);
    this.recipientAccountInfo = getAccountInfoFromMap(
      accountInfoMap,
      recipientKey,
      recipientKeyType,
    );
    this.recipientKey = this.recipientAccountInfo?.publicKey ?? recipientKey;
    this.recipientKeyType = this.recipientAccountInfo?.publicKey ? 'publicKey' : recipientKeyType;
    this.isReceive = isKeysEqual(activePublicKey, this.recipientKey);

    this.fiatAmount = getCep18FiatAmount(
      this.decimalAmount,
      data?.contract_package?.coingecko_data?.price ??
        data?.contract_package?.friendlymarket_data?.price ??
        0,
      false,
    );
    this.formattedFiatAmount = getCep18FiatAmount(
      this.decimalAmount,
      data?.contract_package?.coingecko_data?.price ??
        data?.contract_package?.friendlymarket_data?.price ??
        0,
      true,
    );
    this.fiatCurrency = 'USD';
    this.marketDataProvider = data?.contract_package?.coingecko_data?.price
      ? 'CoinGecko'
      : data?.contract_package?.friendlymarket_data?.price
        ? 'FriendlyMarket'
        : null;
    this.marketDataProviderUrl = getMarketDataProviderUrl(
      this.marketDataProvider,
      data?.contract_package?.coingecko_id,
      data?.contract_package?.latest_version_contract_hash,
    );
  }

  readonly entryPoint: CEP18EntryPointType;
  readonly recipientKey: string;
  readonly isReceive: boolean;
  readonly amount: string;
  readonly decimalAmount: string;
  readonly formattedDecimalAmount: string;
  readonly symbol: string;
  readonly decimals: number;
  readonly contractName: string;
  readonly iconUrl: Maybe<string>;
  readonly recipientKeyType: AccountKeyType;
  readonly recipientAccountInfo: Maybe<IAccountInfo>;

  readonly fiatAmount: string;
  readonly formattedFiatAmount: string;
  readonly fiatCurrency: 'USD';
  readonly marketDataProvider: Maybe<SupportedMarketDataProviders>;
  readonly marketDataProviderUrl: Maybe<string>;
}

export function getCep18RecipientKeyAndType(
  data?: Partial<ExtendedCloudDeploy>,
): Pick<ICep18Deploy, 'recipientKey' | 'recipientKeyType'> {
  const recipient = guardedDeriveSplitDataFromArguments(data?.args?.recipient, 'Hash');
  const recipientAccount = guardedDeriveSplitDataFromArguments(data?.args?.recipient, 'Account');
  const owner = guardedDeriveSplitDataFromArguments(data?.args?.owner, 'Account');
  const spender = guardedDeriveSplitDataFromArguments(data?.args?.spender, 'Hash');

  const info = recipientAccount ?? owner ?? recipient ?? spender;

  if (info?.keyType === 'accountHash' && info?.hash) {
    const publicKey = derivePublicKeyFromCep18ActionResults(info.hash, data);

    if (publicKey) {
      return {
        recipientKey: publicKey,
        recipientKeyType: 'publicKey',
      };
    }
  }

  return {
    recipientKey: info?.hash ?? '',
    recipientKeyType: info?.keyType ?? 'accountHash',
  };
}

export function derivePublicKeyFromCep18ActionResults(
  accountHash: string,
  deploy?: Partial<ExtendedCloudDeploy>,
) {
  return deploy?.ft_token_actions
    ?.reduce<string[]>((acc, cur) => {
      return [...acc, ...[cur.to_public_key, cur.from_public_key].filter(isNotEmpty<string>)];
    }, [])
    .find(publicKey => isKeysEqual(getAccountHashFromPublicKey(publicKey), accountHash));
}
