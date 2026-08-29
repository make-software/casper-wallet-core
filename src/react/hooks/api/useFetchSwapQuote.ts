import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { useRepositories } from '../context/useRepositories';

import type {
  FetchQuoteErrorCodes,
  IDexToken,
  ISwapError,
  ISwapQuote,
  SwapQuoteType,
} from '../../../domain/swap';
import { getMillisecondsUntilNextBlock } from '../../../utils/swap';

export interface IUseFetchSwapQuoteParams {
  type_id: SwapQuoteType;
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
  type_id,
  amount,
  tokenIn,
  tokenOut,
  withAutoRefresh = true,
}: IUseFetchSwapQuoteParams) => {
  const isFirstRefetch = useRef(true);
  const prevQueryKeyRef = useRef<string>('');

  const { network, swapRepository, dexContractRepository } = useRepositories();

  const { data: latestBlockTimestamp } = useQuery({
    queryKey: ['latestBlock'],
    queryFn: () => dexContractRepository.getLatestBlockTime({ network }),
    staleTime: Infinity,
    retry: false,
  });

  const queryKey = ['quote', type_id, amount, tokenIn, tokenOut] as const;
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
        typeId: type_id,
      }),
    enabled: Boolean(tokenIn && tokenOut && amount && amount !== '0'),
    refetchInterval: withAutoRefresh
      ? query => {
          if (!query.state.data) {
            return false;
          }

          return latestBlockTimestamp ? getMillisecondsUntilNextBlock(latestBlockTimestamp) : false;
        }
      : undefined,
    staleTime: 0,
    retry: false,
  });

  const fetchQuoteErrorCode = extractFetchQuoteErrorCode(error);

  return { data, error, isLoading, isFetching, refetch, fetchQuoteErrorCode, dataUpdatedAt };
};
