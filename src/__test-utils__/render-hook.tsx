import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import React from 'react';

import type { IDexContractRepository } from '../domain/dex';
import type { ISwapRepository } from '../domain/swap';
import type { ITokensRepository } from '../domain/tokens';

export const TEST_PUBLIC_KEY = '0106956df3aba7115e28271d053205ec7f33cab259f8e2da2f38150f0ece65a2a8';

export const stubTokensRepository = (over: Partial<ITokensRepository> = {}): ITokensRepository =>
  over as ITokensRepository;

export const stubSwapRepository = (over: Partial<ISwapRepository> = {}): ISwapRepository =>
  over as ISwapRepository;

export const stubDexContractRepository = (
  over: Partial<IDexContractRepository> = {},
): IDexContractRepository => over as IDexContractRepository;

export interface IRenderHookOptions<TProps> {
  initialProps?: TProps;
  queryClient?: QueryClient;
}

/**
 * Renders a hook under a bare `QueryClientProvider`.
 *
 * Retries are disabled: a hook that rejects should surface that on the first attempt rather
 * than making the test wait out the production backoff schedule.
 */
export const renderHookWithQueryClient = <TResult, TProps = undefined>(
  hook: (props: TProps) => TResult,
  { initialProps, queryClient }: IRenderHookOptions<TProps> = {},
) => {
  const client =
    queryClient ?? new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

  const wrapper = ({ children }: React.PropsWithChildren) =>
    React.createElement(QueryClientProvider, { client }, children);

  return renderHook(hook, { wrapper, initialProps: initialProps as TProps });
};
