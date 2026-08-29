import type { IDexToken, ISwapQuote, SwapQuoteType } from './entities';

import type { CasperNetwork } from '../common/common';

export interface ISwapRepository {
  getQuote(params: IGetSwapQuoteParams): Promise<ISwapQuote>;
  getDexTokens(params: IGetDexTokensParams): Promise<IDexToken[]>;
  getDexToken(params: IGetDexTokenParams): Promise<IDexToken>;
}

export interface IGetSwapQuoteParams {
  network: CasperNetwork;
  tokenIn: IDexToken;
  tokenOut: IDexToken;
  amount: string; // raw motes/base units
  typeId: SwapQuoteType;
}

export interface IGetDexTokensParams {
  network: CasperNetwork;
}
export interface IGetDexTokenParams {
  network: CasperNetwork;
  contractPackageHash: string;
}
