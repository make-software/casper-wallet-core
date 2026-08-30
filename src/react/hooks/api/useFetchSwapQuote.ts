import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import type {
  FetchQuoteErrorCodes,
  IDexToken,
  ISwapError,
  ISwapQuote,
  SwapQuoteType,
} from '../../../domain/swap';
import { BLOCK_INTERVAL_MS } from '../../../domain/constants';
import { getMillisecondsUntilNextBlock } from '../../../utils/swap';
import type { ISwapDependencies } from '../../types';

export interface IUseFetchSwapQuoteParams extends Pick<
  ISwapDependencies,
  'network' | 'swapRepository' | 'dexContractRepository'
> {
  typeId: SwapQuoteType;
  amount: string;
  tokenIn: IDexToken | null;
  tokenOut: IDexToken | null;
  withAutoRefresh?: boolean;
}

// `SwapError.data` is the JSON envelope `HttpDataProvider` builds around a failed response, so
// the API's own body — and the quote error code with it — sits one level down under `data.data`.
const extractFetchQuoteErrorCode = (error: ISwapError | null): FetchQuoteErrorCodes | null => {
  const data = error?.data;

  if (typeof data !== 'string') {
    return null;
  }

  try {
    const parsed = JSON.parse(data) as { data?: { error?: { code?: FetchQuoteErrorCodes } } };

    return parsed.data?.error?.code ?? null;
  } catch {
    return null;
  }
};

export const useFetchSwapQuote = ({
  network,
  swapRepository,
  dexContractRepository,
  typeId,
  amount,
  tokenIn,
  tokenOut,
  withAutoRefresh = true,
}: IUseFetchSwapQuoteParams) => {
  const isFirstRefetch = useRef(true);
  const prevQueryKeyRef = useRef<string>('');

  const {
    data: latestBlockTimestamp,
    error: latestBlockError,
    isError: isLatestBlockError,
  } = useQuery({
    queryKey: ['latestBlock', network],
    queryFn: () => dexContractRepository.getLatestBlockTime({ network }),
    staleTime: Infinity,
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const queryKey = ['quote', network, typeId, amount, tokenIn, tokenOut] as const;
  const currentQueryKeyString = JSON.stringify(queryKey);

  useEffect(() => {
    if (prevQueryKeyRef.current !== currentQueryKeyString) {
      isFirstRefetch.current = true;
      prevQueryKeyRef.current = currentQueryKeyString;
    }
  }, [currentQueryKeyString]);

  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useQuery<
    ISwapQuote,
    ISwapError
  >({
    queryKey,
    queryFn: () =>
      swapRepository.getQuote({
        network,
        amount,
        tokenIn: tokenIn as IDexToken, // cast to IDexToken because enabled only with tokenIn and tokenOut not null
        tokenOut: tokenOut as IDexToken,
        typeId,
      }),
    enabled: Boolean(tokenIn && tokenOut && amount && amount !== '0'),
    refetchInterval: withAutoRefresh
      ? query => {
          if (!query.state.data) {
            return false;
          }

          // Without a block time the quote still has to refresh: "no block time" is not "no
          // refresh", or one failed RPC read at mount freezes the displayed price for the
          // session and the user signs a stale quote.
          return latestBlockTimestamp
            ? getMillisecondsUntilNextBlock(latestBlockTimestamp)
            : BLOCK_INTERVAL_MS;
        }
      : undefined,
    staleTime: 0,
    retry: false,
  });

  const fetchQuoteErrorCode = extractFetchQuoteErrorCode(error);

  return {
    data,
    error,
    isLoading,
    isFetching,
    refetch,
    fetchQuoteErrorCode,
    dataUpdatedAt,
    /** The chain-time read behind the auto-refresh schedule; refresh falls back to a fixed
     * interval when it fails, so this is the only signal that it did. */
    latestBlockError,
    isLatestBlockError,
  };
};
