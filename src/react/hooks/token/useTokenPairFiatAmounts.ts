import { useFetchCsprFiatRates } from '../api/useFetchCsprFiatRates';
import { useRepositories } from '../context/useRepositories';

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
  const { currencyCode } = useRepositories();

  const firstTokenFiatAmount = calculateTokenFiatAmount(
    firstToken as IDexToken | null,
    firstTokenAmount,
    currencyCode,
    firstToken?.fiatRates,
    csprFiatRates,
  );

  const secondTokenFiatAmount = calculateTokenFiatAmount(
    secondToken as IDexToken | null,
    secondTokenAmount,
    currencyCode,
    secondToken?.fiatRates,
    csprFiatRates,
  );

  return {
    firstTokenFiatAmount,
    secondTokenFiatAmount,
    csprFiatRates,
  };
};
