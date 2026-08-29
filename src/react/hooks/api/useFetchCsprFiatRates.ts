import { useQuery } from '@tanstack/react-query';

import { useRepositories } from '../context/useRepositories';

import type { ITokensError } from '../../../domain/tokens';

export const useFetchCsprFiatRates = () => {
  const { network, tokensRepository } = useRepositories();

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
