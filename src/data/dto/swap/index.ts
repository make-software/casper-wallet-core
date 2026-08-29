import type { IDexToken, ISwapQuote, SwapQuoteType } from '../../../domain';
import { CSPR_COIN, CSPR_NATIVE_TOKEN_ID } from '../../../domain';
import { calculateSwapRate, getDecimalTokenBalance } from '../../../utils';
import type { DexTokenApiResponse, RawSwapQuote } from '../../repositories/swap/types';

/**
 * Maps the WCSPR API record to a synthetic native token while keeping the real on-chain
 * `packageHash` — this is what makes `token.id === CSPR_NATIVE_TOKEN_ID` the native-token check
 * everywhere else in the swap domain.
 */
export class DexTokenDto implements IDexToken {
  constructor(resp: DexTokenApiResponse, wrappedCsprPackageHash: string) {
    const { contract_package: contractPackage, contract_package_hash: contractPackageHash } = resp;
    const isWrappedCspr = contractPackageHash === wrappedCsprPackageHash;

    this.id = isWrappedCspr ? CSPR_NATIVE_TOKEN_ID : contractPackageHash;
    this.name = isWrappedCspr ? CSPR_COIN.name : contractPackage.metadata.name;
    this.symbol = isWrappedCspr ? CSPR_COIN.symbol : contractPackage.metadata.symbol;
    this.icon = contractPackage.icon_url;
    this.decimals = contractPackage.metadata.decimals;
    this.packageHash = contractPackageHash;
    this.isWhitelisted = resp.is_whitelisted;
    this.isBlacklisted = resp.is_blacklisted;
    this.fiatRates = contractPackage.token_market_data?.[0]?.latest_rate ?? null;
    this.totalValueLocked = resp.total_value_locked ?? null;
    this.volume24h = contractPackage.token_market_data?.[0]?.volume_24h ?? null;
  }

  readonly id: string;
  readonly name: string;
  readonly symbol: string;
  readonly icon: string | null;
  readonly decimals: number;
  readonly packageHash: string;
  readonly isWhitelisted: boolean;
  readonly isBlacklisted: boolean;
  readonly fiatRates: number | null;
  readonly totalValueLocked: string | null;
  readonly volume24h: string | null;
}

export class SwapQuoteDto implements ISwapQuote {
  constructor(resp: RawSwapQuote, tokenIn: IDexToken, tokenOut: IDexToken, typeId: SwapQuoteType) {
    this.amount_in = resp.amount_in;
    this.amount_out = resp.amount_out;
    this.execution_price = resp.execution_price;
    this.mid_price = resp.mid_price;
    this.path = resp.path;
    this.price_impact = resp.price_impact;
    this.recommended_slippage_bps = resp.recommended_slippage_bps;
    this.type_id = typeId;

    this.amountInDecimal = getDecimalTokenBalance(resp.amount_in, tokenIn.decimals, '0');
    this.amountOutDecimal = getDecimalTokenBalance(resp.amount_out, tokenOut.decimals, '0');
    this.rate = calculateSwapRate(
      resp.amount_in,
      tokenIn.decimals,
      resp.amount_out,
      tokenOut.decimals,
      typeId,
    );
  }

  readonly amount_in: string;
  readonly amount_out: string;
  readonly execution_price: string;
  readonly mid_price: string;
  readonly path: string[];
  readonly price_impact: string;
  readonly recommended_slippage_bps: string;
  readonly type_id: SwapQuoteType;
  readonly amountInDecimal: string;
  readonly amountOutDecimal: string;
  readonly rate: string;
}
