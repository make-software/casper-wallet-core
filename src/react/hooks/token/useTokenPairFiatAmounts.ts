import { useFetchCsprFiatRates } from '../api/useFetchCsprFiatRates';

import { USD_CURRENCY_CODE } from '../../../domain/constants';
import type { IDexToken } from '../../../domain/swap';
import { calculateTokenFiatAmount } from '../../../utils/swap';

type TokenLike = Pick<IDexToken, 'id' | 'fiatRates'>;

interface IUseTokenPairFiatAmountsParams {
  firstToken: TokenLike | null;
  secondToken: TokenLike | null;
  firstTokenAmount: string;
  secondTokenAmount: string;
}

export const useTokenPairFiatAmounts = ({
  firstToken,
  secondToken,
  firstTokenAmount,
  secondTokenAmount,
}: IUseTokenPairFiatAmountsParams) => {
  const { csprFiatRates } = useFetchCsprFiatRates();

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
