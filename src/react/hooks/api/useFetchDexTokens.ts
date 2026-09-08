import { useQuery } from '@tanstack/react-query';

import type { IDexToken, ISwapError } from '../../../domain/swap';
import type { ISwapDependencies } from '../../types';

export interface IUseFetchDexTokensParams extends Pick<
  ISwapDependencies,
  'network' | 'swapRepository'
> {}

export const useFetchDexTokens = ({ network, swapRepository }: IUseFetchDexTokensParams) => {
  return useQuery<IDexToken[], ISwapError>({
    queryKey: ['tokens', network],
    queryFn: () => swapRepository.getDexTokens({ network }),
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};
