import { useQuery } from '@tanstack/react-query';

import type { ITokensError } from '../../../domain/tokens';
import type { ISwapDependencies } from '../../types';

export interface IUseFetchCsprFiatRatesParams extends Pick<
  ISwapDependencies,
  'network' | 'tokensRepository'
> {}

export const useFetchCsprFiatRates = ({
  network,
  tokensRepository,
}: IUseFetchCsprFiatRatesParams) => {
  const {
    data: csprFiatRates,
    isLoading,
    error,
  } = useQuery<number, ITokensError>({
    queryKey: ['csprFiatRates', network],
    queryFn: async () => (await tokensRepository.getCsprFiatCurrencyRate({ network })).rate,
    retry: false,
  });

  return { csprFiatRates, error, isLoading };
};
