import { useQuery } from '@tanstack/react-query';

import { useRepositories } from '../context/useRepositories';

import type { IDexError } from '../../../domain/dex';

interface IUseFetchTokenBalanceParams {
  contractPackageHash: string;
  enabled?: boolean;
}

/**
 * Fetches a CEP-18 token balance directly from RPC (dictionary lookup).
 * Unlike useFetchAccountTokenOwnership (which goes through the backend indexer),
 * this returns the on-chain state immediately — no block-indexing lag.
 *
 * Returns `data` as a raw balance string (motes / smallest unit).
 */
export const useFetchTokenBalance = ({
  contractPackageHash,
  enabled = true,
}: IUseFetchTokenBalanceParams) => {
  const { network, activePublicKey, dexContractRepository } = useRepositories();

  const { data, isLoading, error, refetch, isFetching, isError } = useQuery<string, IDexError>({
    queryKey: ['tokenBalance', activePublicKey, contractPackageHash],
    enabled: Boolean(activePublicKey) && Boolean(contractPackageHash) && enabled,
    queryFn: () => {
      if (!activePublicKey) {
        throw new Error('Public key is required');
      }

      return dexContractRepository.getTokenBalance({
        network,
        contractPackageHash,
        publicKey: activePublicKey,
      });
    },
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchInterval: 30000, // 30 seconds
  });

  return { data, error, isLoading, refetch, isFetching, isError };
};
