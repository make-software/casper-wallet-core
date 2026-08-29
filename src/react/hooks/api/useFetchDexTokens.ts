import { useQuery } from '@tanstack/react-query';

import { useRepositories } from '../context/useRepositories';

import type { IDexToken, ISwapError } from '../../../domain/swap';

export const useFetchDexTokens = () => {
  const { network, currencyId, swapRepository } = useRepositories();

  return useQuery<IDexToken[], ISwapError>({
    queryKey: ['tokens', currencyId],
    queryFn: () => swapRepository.getDexTokens({ network, currencyId }),
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};
