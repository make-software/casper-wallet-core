import { useQuery } from '@tanstack/react-query';

import { useRepositories } from '../context/useRepositories';

import type { ISwapError } from '../../../domain/swap';

// The only dex the trade API's fiat-rates endpoint serves today, so it is not a repository param.
const DEX_ID_CSPR_TRADE = 1;

export interface IUseFetchTokenFiatRatesParams {
  contractPackageHash?: string | null;
}

export const useFetchTokenFiatRates = ({ contractPackageHash }: IUseFetchTokenFiatRatesParams) => {
  const { network, currencyId, swapRepository } = useRepositories();

  const {
    data: tokenFiatRates,
    isLoading,
    error,
  } = useQuery<number | null, ISwapError>({
    queryKey: ['tokenFiatRates', contractPackageHash, DEX_ID_CSPR_TRADE, currencyId],
    queryFn: () =>
      swapRepository.getTokenFiatRate({
        network,
        contractPackageHash: contractPackageHash as string,
        currencyId,
      }),
    enabled: Boolean(contractPackageHash),
    retry: false,
  });

  return { tokenFiatRates, error, isLoading };
};
