/**
 * @jest-environment jsdom
 */
import { QueryClient } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react';

import { useFetchAccountTokenOwnership } from './useFetchAccountTokenOwnership';
import { useFetchCsprFiatRates } from './useFetchCsprFiatRates';
import { useFetchSwapQuote } from './useFetchSwapQuote';
import { useFetchTokenBalance } from './useFetchTokenBalance';

import {
  renderHookWithQueryClient,
  stubDexContractRepository,
  stubSwapRepository,
  stubTokensRepository,
  TEST_PUBLIC_KEY,
} from '../../../__test-utils__/render-hook';
import type { CasperNetwork } from '../../../domain/common/common';
import type { IDexToken } from '../../../domain/swap';
import { SwapQuoteType } from '../../../domain/swap';
import type { ITokenWithFiatBalance } from '../../../domain/tokens';

const makeToken = (contractPackageHash: string, balance: string): ITokenWithFiatBalance =>
  ({ contractPackageHash, balance, decimals: 9 }) as ITokenWithFiatBalance;

const makeDexToken = (packageHash: string): IDexToken =>
  ({ id: packageHash, packageHash, decimals: 9 }) as IDexToken;

describe('useFetchAccountTokenOwnership', () => {
  it('reads holdings from the wallet API, narrowed to the requested packages', async () => {
    const getTokens = jest.fn().mockResolvedValue([makeToken('cph-1', '100')]);

    const { result } = renderHookWithQueryClient(() =>
      useFetchAccountTokenOwnership({
        network: 'mainnet',
        activePublicKey: TEST_PUBLIC_KEY,
        tokensRepository: stubTokensRepository({ getTokens }),
        contractPackageHashes: ['cph-1', 'cph-2'],
      }),
    );

    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(getTokens).toHaveBeenCalledWith({
      network: 'mainnet',
      publicKey: TEST_PUBLIC_KEY,
      contractPackageHashes: ['cph-1', 'cph-2'],
    });
  });

  it('does not query while no account is connected', () => {
    const getTokens = jest.fn();

    renderHookWithQueryClient(() =>
      useFetchAccountTokenOwnership({
        network: 'mainnet',
        activePublicKey: null,
        tokensRepository: stubTokensRepository({ getTokens }),
      }),
    );

    expect(getTokens).not.toHaveBeenCalled();
  });
});

describe('useFetchTokenBalance', () => {
  it('picks the balance of the requested contract package', async () => {
    const getTokens = jest
      .fn()
      .mockResolvedValue([makeToken('cph-other', '1'), makeToken('cph-1', '4200')]);

    const { result } = renderHookWithQueryClient(() =>
      useFetchTokenBalance({
        network: 'mainnet',
        activePublicKey: TEST_PUBLIC_KEY,
        tokensRepository: stubTokensRepository({ getTokens }),
        contractPackageHash: 'cph-1',
      }),
    );

    await waitFor(() => expect(result.current.data).toBe('4200'));
  });

  it('reports "0" for a token the account has never held', async () => {
    const getTokens = jest.fn().mockResolvedValue([]);

    const { result } = renderHookWithQueryClient(() =>
      useFetchTokenBalance({
        network: 'mainnet',
        activePublicKey: TEST_PUBLIC_KEY,
        tokensRepository: stubTokensRepository({ getTokens }),
        contractPackageHash: 'cph-1',
      }),
    );

    await waitFor(() => expect(result.current.data).toBe('0'));
  });

  it('stays undefined until the request resolves, so callers can tell empty from unknown', () => {
    const getTokens = jest.fn().mockReturnValue(new Promise(() => {}));

    const { result } = renderHookWithQueryClient(() =>
      useFetchTokenBalance({
        network: 'mainnet',
        activePublicKey: TEST_PUBLIC_KEY,
        tokensRepository: stubTokensRepository({ getTokens }),
        contractPackageHash: 'cph-1',
      }),
    );

    expect(result.current.data).toBeUndefined();
  });

  it('requests only the one package it was asked about', async () => {
    const getTokens = jest.fn().mockResolvedValue([]);

    const { result } = renderHookWithQueryClient(() =>
      useFetchTokenBalance({
        network: 'mainnet',
        activePublicKey: TEST_PUBLIC_KEY,
        tokensRepository: stubTokensRepository({ getTokens }),
        contractPackageHash: 'cph-1',
      }),
    );

    await waitFor(() => expect(result.current.data).toBe('0'));
    expect(getTokens).toHaveBeenCalledWith(
      expect.objectContaining({ contractPackageHashes: ['cph-1'] }),
    );
  });
});

describe('useFetchCsprFiatRates', () => {
  it('unwraps the rate from the wallet API fiat-rate DTO', async () => {
    const getCsprFiatCurrencyRate = jest.fn().mockResolvedValue({ rate: 0.0123, currency: 'USD' });

    const { result } = renderHookWithQueryClient(() =>
      useFetchCsprFiatRates({
        network: 'mainnet',
        tokensRepository: stubTokensRepository({ getCsprFiatCurrencyRate }),
      }),
    );

    await waitFor(() => expect(result.current.csprFiatRates).toBe(0.0123));
    expect(getCsprFiatCurrencyRate).toHaveBeenCalledWith({ network: 'mainnet' });
  });

  it('fetches the rate even with no account connected', async () => {
    const getCsprFiatCurrencyRate = jest.fn().mockResolvedValue({ rate: 1, currency: 'USD' });

    const { result } = renderHookWithQueryClient(() =>
      useFetchCsprFiatRates({
        network: 'mainnet',
        tokensRepository: stubTokensRepository({ getCsprFiatCurrencyRate }),
      }),
    );

    await waitFor(() => expect(result.current.csprFiatRates).toBe(1));
  });
});

describe('useFetchAccountTokenOwnership across networks', () => {
  it('refetches for the new network instead of serving the previous network cache', async () => {
    const getTokens = jest.fn(({ network }: { network: CasperNetwork }) =>
      Promise.resolve([makeToken('cph-1', network === 'mainnet' ? '1' : '2')]),
    );
    const tokensRepository = stubTokensRepository({ getTokens });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });

    const { result, rerender } = renderHookWithQueryClient(
      ({ network }: { network: CasperNetwork }) =>
        useFetchAccountTokenOwnership({
          network,
          activePublicKey: TEST_PUBLIC_KEY,
          tokensRepository,
        }),
      { initialProps: { network: 'mainnet' as CasperNetwork }, queryClient },
    );

    await waitFor(() => expect(result.current.data?.[0]?.balance).toBe('1'));

    rerender({ network: 'testnet' as CasperNetwork });

    await waitFor(() => expect(result.current.data?.[0]?.balance).toBe('2'));
    expect(getTokens).toHaveBeenCalledTimes(2);
    expect(getTokens).toHaveBeenLastCalledWith(expect.objectContaining({ network: 'testnet' }));
  });
});

describe('useFetchSwapQuote across networks', () => {
  it('refetches the quote and the latest block for the new network', async () => {
    const getQuote = jest.fn().mockResolvedValue({
      amountIn: '1000000000',
      amountOut: '2000000000',
      executionPrice: '2',
      midPrice: '2',
      path: [],
      priceImpact: '0',
      recommendedSlippageBps: '50',
      typeId: SwapQuoteType.ExactIn,
      amountInDecimal: '1',
      amountOutDecimal: '2',
      rate: '2',
    });
    const getLatestBlockTime = jest.fn().mockResolvedValue(1000);
    const swapRepository = stubSwapRepository({ getQuote });
    const dexContractRepository = stubDexContractRepository({ getLatestBlockTime });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });

    const { rerender } = renderHookWithQueryClient(
      ({ network }: { network: CasperNetwork }) =>
        useFetchSwapQuote({
          network,
          swapRepository,
          dexContractRepository,
          typeId: SwapQuoteType.ExactIn,
          amount: '1000000000',
          tokenIn: makeDexToken('cph-1'),
          tokenOut: makeDexToken('cph-2'),
          withAutoRefresh: false,
        }),
      { initialProps: { network: 'mainnet' as CasperNetwork }, queryClient },
    );

    await waitFor(() => expect(getQuote).toHaveBeenCalledTimes(1));

    rerender({ network: 'testnet' as CasperNetwork });

    await waitFor(() => expect(getQuote).toHaveBeenCalledTimes(2));
    expect(getQuote).toHaveBeenLastCalledWith(expect.objectContaining({ network: 'testnet' }));
    await waitFor(() => expect(getLatestBlockTime).toHaveBeenCalledTimes(2));
  });
});
