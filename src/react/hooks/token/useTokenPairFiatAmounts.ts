import { useFetchCsprFiatRates } from '../api/useFetchCsprFiatRates';

import { USD_CURRENCY_CODE } from '../../../domain/constants';
import type { IDexToken } from '../../../domain/swap';
import { calculateTokenFiatAmount } from '../../../utils/swap';
import type { ISwapDependencies } from '../../types';

type TokenLike = Pick<IDexToken, 'id' | 'fiatRates'>;

export interface IUseTokenPairFiatAmountsParams extends Pick<
  ISwapDependencies,
  'network' | 'tokensRepository'
> {
  firstToken: TokenLike | null;
  secondToken: TokenLike | null;
  firstTokenAmount: string;
  secondTokenAmount: string;
}

export const useTokenPairFiatAmounts = ({
  network,
  tokensRepository,
  firstToken,
  secondToken,
  firstTokenAmount,
  secondTokenAmount,
}: IUseTokenPairFiatAmountsParams) => {
  const { csprFiatRates } = useFetchCsprFiatRates({ network, tokensRepository });

  const firstTokenFiatAmount = calculateTokenFiatAmount(
    firstToken as IDexToken | null,
    firstTokenAmount,
    USD_CURRENCY_CODE,
    firstToken?.fiatRates,
    csprFiatRates,
  );

  const secondTokenFiatAmount = calculateTokenFiatAmount(
    secondToken as IDexToken | null,
    secondTokenAmount,
    USD_CURRENCY_CODE,
    secondToken?.fiatRates,
    csprFiatRates,
  );

  return {
    firstTokenFiatAmount,
    secondTokenFiatAmount,
    csprFiatRates,
  };
};
