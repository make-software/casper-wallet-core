import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import React from 'react';

import { RepositoriesProvider } from '../react/providers/RepositoriesProvider';

import type { IDexContractRepository } from '../domain/dex';
import type { ISwapRepository } from '../domain/swap';
import type { ITokensRepository } from '../domain/tokens';
import type { IRepositoriesContextValue } from '../react/types';

export const TEST_PUBLIC_KEY = '0106956df3aba7115e28271d053205ec7f33cab259f8e2da2f38150f0ece65a2a8';

type RepositoryOverrides = {
  tokensRepository?: Partial<ITokensRepository>;
  swapRepository?: Partial<ISwapRepository>;
  dexContractRepository?: Partial<IDexContractRepository>;
};

export interface IRenderHookOptions extends RepositoryOverrides {
  activePublicKey?: string | null;
  network?: IRepositoriesContextValue['network'];
}

/**
 * Renders a hook against the real providers with stub repositories.
 *
 * Retries are disabled: a hook that rejects should surface that on the first attempt rather
 * than making the test wait out the production backoff schedule.
 */
export const renderHookWithProviders = <TResult,>(
  hook: () => TResult,
  {
    activePublicKey = TEST_PUBLIC_KEY,
    network = 'mainnet',
    tokensRepository,
    swapRepository,
    dexContractRepository,
  }: IRenderHookOptions = {},
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  const value = {
    network,
    activePublicKey,
    signer: null,
    tokensRepository: (tokensRepository ?? {}) as ITokensRepository,
    swapRepository: (swapRepository ?? {}) as ISwapRepository,
    dexContractRepository: (dexContractRepository ?? {}) as IDexContractRepository,
  } satisfies IRepositoriesContextValue;

  const wrapper = ({ children }: React.PropsWithChildren) =>
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(RepositoriesProvider, { value }, children),
    );

  return renderHook(hook, { wrapper });
};
