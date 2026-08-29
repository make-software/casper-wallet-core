import { useQuery } from '@tanstack/react-query';

import { useRepositories } from '../context/useRepositories';

import type { IDexToken, ISwapError } from '../../../domain/swap';

export const useFetchToken = (tokenContractPackageHash: string) => {
  const { network, swapRepository } = useRepositories();

  const {
    data: token,
    isLoading,
    error,
    refetch,
    isFetching,
    isError,
  } = useQuery<IDexToken, ISwapError>({
    queryKey: ['token', tokenContractPackageHash, network],
    queryFn: () =>
      swapRepository.getDexToken({
        network,
        contractPackageHash: tokenContractPackageHash,
      }),
    enabled: Boolean(tokenContractPackageHash),
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const errorMessage = error?.status === 400 ? 'Pair not found' : error?.message;

  return { token, error, isLoading, refetch, isFetching, isError, errorMessage };
};
