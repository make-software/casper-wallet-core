import Decimal from 'decimal.js';

import { formatTokenBalance, getDecimalTokenBalance } from '../../utils';
import {
  CSPR_DECIMALS,
  ICsprBalance,
  IToken,
  ITokenFiatRate,
  Network,
  SupportedFiatCurrencies,
} from '../../domain';
import { ApiToken, IGetCsprBalanceResponse, IGetCurrencyRateResponse } from '../repositories';
import { Maybe } from '../../typings';

export class TokenDto implements IToken {
  constructor(network: Network, apiToken?: Partial<ApiToken>) {
    this.contractHash = apiToken?.contractHash ?? '';
    this.contractPackageHash = apiToken?.contract_package_hash ?? '';
    this.id = this.contractPackageHash;
    this.balance = apiToken?.balance ?? '0';
    this.network = apiToken?.network ?? network;
    this.decimals = apiToken?.metadata?.decimals ?? 18;
    this.iconUrl = apiToken?.icon_url ?? null;
    this.name = apiToken?.contract_name ?? '';
    this.symbol = apiToken?.metadata?.symbol ?? '';
    this.decimalBalance = getDecimalTokenBalance(this.balance, this.decimals);
    this.formattedDecimalBalance = formatTokenBalance(this.balance, this.decimals);
    this.isNative = this.symbol === 'CSPR';
  }

  readonly balance: string;
  readonly contractHash: string;
  readonly contractPackageHash: string;
  readonly decimals: number;
  readonly iconUrl: Maybe<string>;
  readonly id: string;
  readonly name: string;
  readonly network: Network;
  readonly symbol: string;
  readonly decimalBalance: string;
  readonly formattedDecimalBalance: string;
  readonly isNative: boolean;
}

export class CsprBalanceDto implements ICsprBalance {
  constructor(resp?: Partial<IGetCsprBalanceResponse>) {
    this.liquidBalance = `${resp?.data?.balance ?? '0'}`;
    this.liquidDecimalBalance = getDecimalTokenBalance(this.liquidBalance, CSPR_DECIMALS);
    this.liquidFormattedDecimalBalance = formatTokenBalance(this.liquidBalance, CSPR_DECIMALS);

    this.delegatedBalance = `${resp?.data?.delegated_balance ?? '0'}`;
    this.delegatedDecimalBalance = getDecimalTokenBalance(this.delegatedBalance, CSPR_DECIMALS);
    this.delegatedFormattedDecimalBalance = formatTokenBalance(
      this.delegatedBalance,
      CSPR_DECIMALS,
    );

    this.undelegatingBalance = `${resp?.data?.undelegating_balance ?? '0'}`;
    this.undelegatingDecimalBalance = getDecimalTokenBalance(
      this.undelegatingBalance,
      CSPR_DECIMALS,
    );
    this.undelegatingFormattedDecimalBalance = formatTokenBalance(
      this.undelegatingBalance,
      CSPR_DECIMALS,
    );

    this.totalBalance = new Decimal(this.liquidBalance)
      .plus(this.delegatedBalance)
      .plus(this.undelegatingBalance)
      .toFixed();
    this.totalDecimalBalance = getDecimalTokenBalance(this.totalBalance, CSPR_DECIMALS);
    this.totalFormattedDecimalBalance = formatTokenBalance(this.totalBalance, CSPR_DECIMALS);
  }

  readonly totalBalance: string;
  readonly totalDecimalBalance: string;
  readonly totalFormattedDecimalBalance: string;

  readonly delegatedBalance: string;
  readonly delegatedDecimalBalance: string;
  readonly delegatedFormattedDecimalBalance: string;

  readonly undelegatingBalance: string;
  readonly undelegatingDecimalBalance: string;
  readonly undelegatingFormattedDecimalBalance: string;

  readonly liquidBalance: string;
  readonly liquidDecimalBalance: string;
  readonly liquidFormattedDecimalBalance: string;
}

export class TokenFiatRateDto implements ITokenFiatRate {
  constructor(resp?: Partial<IGetCurrencyRateResponse>) {
    this.rate = Number(resp?.data) || 0;
    this.currency = 'USD';
  }

  readonly currency: SupportedFiatCurrencies;
  readonly rate: number;
}
