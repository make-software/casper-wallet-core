import { useQuery } from '@tanstack/react-query';

import type { ITokensError, ITokenWithFiatBalance } from '../../../domain/tokens';
import type { ISwapDependencies } from '../../types';

export interface IUseFetchAccountTokenOwnershipParams extends Pick<
  ISwapDependencies,
  'network' | 'activePublicKey' | 'tokensRepository'
> {
  contractPackageHashes?: string[];
  enabled?: boolean;
}

/**
 * CEP-18 holdings from the wallet API — the same source that backs the wallet's own token list,
 * so a balance never depends on which screen asked for it.
 */
export const useFetchAccountTokenOwnership = ({
  network,
  activePublicKey,
  tokensRepository,
  contractPackageHashes,
  enabled = true,
}: IUseFetchAccountTokenOwnershipParams) => {
  const { data, isLoading, error, refetch, isFetching, isError } = useQuery<
    ITokenWithFiatBalance[],
    ITokensError
  >({
    queryKey: [
      'accountTokenOwnership',
      network,
      activePublicKey,
      contractPackageHashes?.join(',') ?? 'all',
    ],
    enabled: Boolean(activePublicKey) && enabled,
    queryFn: () => {
      if (!activePublicKey) {
        throw new Error('Public key is required');
      }

      return tokensRepository.getTokens({
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
