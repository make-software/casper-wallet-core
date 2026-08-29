import { useMemo } from 'react';

import { useFetchAccountTokenOwnership } from './useFetchAccountTokenOwnership';

interface IUseFetchTokenBalanceParams {
  contractPackageHash: string;
  enabled?: boolean;
}

/**
 * Single CEP-18 token balance from the wallet API. Narrows {@link useFetchAccountTokenOwnership}
 * to one contract package so every balance in the library resolves against one source of truth.
 *
 * Returns `data` as a raw balance string (smallest unit), or `undefined` while unresolved.
 */
export const useFetchTokenBalance = ({
  contractPackageHash,
  enabled = true,
}: IUseFetchTokenBalanceParams) => {
  const contractPackageHashes = useMemo(() => [contractPackageHash], [contractPackageHash]);

  const { data, isLoading, error, refetch, isFetching, isError } = useFetchAccountTokenOwnership({
    contractPackageHashes,
    enabled: Boolean(contractPackageHash) && enabled,
  });

  // An account that has never held the token has no ownership row, which is a zero balance
  // rather than missing data.
  const balance = useMemo(
    () =>
      data
        ? (data.find(token => token.contractPackageHash === contractPackageHash)?.balance ?? '0')
        : undefined,
    [data, contractPackageHash],
  );

  return { data: balance, error, isLoading, refetch, isFetching, isError };
};
