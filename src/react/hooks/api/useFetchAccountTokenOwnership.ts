import { useQuery } from '@tanstack/react-query';

import { useRepositories } from '../context/useRepositories';

import type { IAccountTokenOwnershipItem, ISwapError } from '../../../domain/swap';

interface IUseFetchAccountTokenOwnershipParams {
  contractPackageHashes?: string[];
  enabled?: boolean;
}

export const useFetchAccountTokenOwnership = ({
  contractPackageHashes,
  enabled = true,
}: IUseFetchAccountTokenOwnershipParams = {}) => {
  const { network, activePublicKey, swapRepository } = useRepositories();

  const { data, isLoading, error, refetch, isFetching, isError } = useQuery<
    IAccountTokenOwnershipItem[],
    ISwapError
  >({
    queryKey: ['accountTokenOwnership', activePublicKey, contractPackageHashes?.join(',') ?? 'all'],
    enabled: Boolean(activePublicKey) && enabled,
    queryFn: () => {
      if (!activePublicKey) {
        throw new Error('Public key is required');
      }

      return swapRepository.getAccountTokenOwnership({
        network,
        publicKey: activePublicKey,
        contractPackageHashes,
      });
    },
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchInterval: 30000, // 30 seconds
  });

  return { data, error, isLoading, refetch, isFetching, isError };
};
