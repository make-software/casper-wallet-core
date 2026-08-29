import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useRepositories } from '../context/useRepositories';

import { WrappedCsprContractPackageHash } from '../../../domain/constants/dex';
import type { IDexToken } from '../../../domain/swap';
import { getSwapRoutes, type WcsprDisplay } from '../../../utils/swap';

/**
 * Resolves the token objects for a quote's `path` hashes: known tokens (`tokens`) are used
 * as-is, anything missing (e.g. a route hop outside the listed-token set) is fetched
 * individually. The per-hash query key `['token', hash, currencyId]` must stay identical to
 * `useFetchToken`'s — the two share the cache entry.
 */
export const useSwapRouteTokens = (
  path: string[] = [],
  tokens: IDexToken[] = [],
  options: { enabled?: boolean; wcsprDisplay?: WcsprDisplay } = {},
): IDexToken[] => {
  const { enabled = true, wcsprDisplay = 'native' } = options;
  const { network, currencyId, swapRepository } = useRepositories();

  const wrappedCsprPackageHash = WrappedCsprContractPackageHash[network];

  const missingHashes = useMemo(
    () =>
      path.filter(
        hash =>
          hash !== wrappedCsprPackageHash &&
          !tokens.some(token => token.packageHash.toLowerCase() === hash.toLowerCase()),
      ),
    [path, tokens, wrappedCsprPackageHash],
  );

  const queries = useQueries({
    queries: missingHashes.map(hash => ({
      queryKey: ['token', hash, currencyId],
      queryFn: () => swapRepository.getDexToken({ network, contractPackageHash: hash, currencyId }),
      enabled: enabled && Boolean(hash),
      retry: 3,
      retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
    })),
  });

  return useMemo(() => {
    const fetchedTokens = queries
      .map(query => query.data)
      .filter((token): token is IDexToken => Boolean(token));

    return getSwapRoutes(path, [...tokens, ...fetchedTokens], wrappedCsprPackageHash, {
      wcsprDisplay,
    });
  }, [path, tokens, queries, wcsprDisplay, wrappedCsprPackageHash]);
};
