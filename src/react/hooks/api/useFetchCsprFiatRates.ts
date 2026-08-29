import { useQuery } from '@tanstack/react-query';

import { useRepositories } from '../context/useRepositories';

import type { ISwapError } from '../../../domain/swap';

export const useFetchCsprFiatRates = () => {
  const { network, currencyId, swapRepository } = useRepositories();

  const {
    data: csprFiatRates,
    isLoading,
    error,
  } = useQuery<number, ISwapError>({
    queryKey: ['csprFiatRates', currencyId],
    queryFn: () => swapRepository.getCsprFiatRate({ network, currencyId }),
    retry: false,
  });

  return { csprFiatRates, error, isLoading };
};
