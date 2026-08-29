import { useQuery } from '@tanstack/react-query';

import type { IDexToken, ISwapError } from '../../../domain/swap';
import type { ISwapDependencies } from '../../types';

export interface IUseFetchTokenParams extends Pick<
  ISwapDependencies,
  'network' | 'swapRepository'
> {
  contractPackageHash: string;
}

export const useFetchToken = ({
  contractPackageHash,
  network,
  swapRepository,
}: IUseFetchTokenParams) => {
  const {
    data: token,
    isLoading,
    error,
    refetch,
    isFetching,
    isError,
  } = useQuery<IDexToken, ISwapError>({
    queryKey: ['token', contractPackageHash, network],
    queryFn: () =>
      swapRepository.getDexToken({
        network,
        contractPackageHash,
      }),
    enabled: Boolean(contractPackageHash),
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const errorMessage = error?.status === 400 ? 'Pair not found' : error?.message;

  return { token, error, isLoading, refetch, isFetching, isError, errorMessage };
};
