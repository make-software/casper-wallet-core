import type {
  IAccountTokenOwnershipItem,
  IDexToken,
  ISwapHistoryEntry,
  ISwapQuote,
  SwapQuoteType,
} from './entities';

import type { CasperNetwork } from '../common/common';
import type { PaginatedResponse } from '../common/http/data-provider';

export interface ISwapRepository {
  getQuote(params: IGetSwapQuoteParams): Promise<ISwapQuote>;
  getDexTokens(params: IGetDexTokensParams): Promise<IDexToken[]>;
  getDexToken(params: IGetDexTokenParams): Promise<IDexToken>;
  getAccountTokenOwnership(
    params: IGetAccountTokenOwnershipParams,
  ): Promise<IAccountTokenOwnershipItem[]>;
  getCsprFiatRate(params: IGetCsprFiatRateParams): Promise<number>;
  getTokenFiatRate(params: IGetTokenFiatRateParams): Promise<number | null>;
  getSwapsHistory(params: IGetSwapsHistoryParams): Promise<PaginatedResponse<ISwapHistoryEntry>>;
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
  currencyId: number;
}
export interface IGetDexTokenParams {
  network: CasperNetwork;
  contractPackageHash: string;
  currencyId: number;
}
export interface IGetAccountTokenOwnershipParams {
  network: CasperNetwork;
  publicKey: string;
  contractPackageHashes?: string[];
}
export interface IGetCsprFiatRateParams {
  network: CasperNetwork;
  currencyId: number;
}
export interface IGetTokenFiatRateParams {
  network: CasperNetwork;
  contractPackageHash: string;
  currencyId: number;
}
export interface IGetSwapsHistoryParams {
  network: CasperNetwork;
  pagination?: { page: number; pageSize: number };
  orderBy?: 'timestamp';
  orderDirection?: 'ASC' | 'DESC';
  pairContractPackageHash?: string;
  tokenContractPackageHash?: string;
  currencyId?: number;
}
