/**
 * @jest-environment jsdom
 */
import { waitFor } from '@testing-library/react';

import { useFetchAccountTokenOwnership } from './useFetchAccountTokenOwnership';
import { useFetchCsprFiatRates } from './useFetchCsprFiatRates';
import { useFetchTokenBalance } from './useFetchTokenBalance';

import { renderHookWithProviders, TEST_PUBLIC_KEY } from '../../../__test-utils__/render-hook';
import type { ITokenWithFiatBalance } from '../../../domain/tokens';

const makeToken = (contractPackageHash: string, balance: string): ITokenWithFiatBalance =>
  ({ contractPackageHash, balance, decimals: 9 }) as ITokenWithFiatBalance;

describe('useFetchAccountTokenOwnership', () => {
  it('reads holdings from the wallet API, narrowed to the requested packages', async () => {
    const getTokens = jest.fn().mockResolvedValue([makeToken('cph-1', '100')]);

    const { result } = renderHookWithProviders(
      () => useFetchAccountTokenOwnership({ contractPackageHashes: ['cph-1', 'cph-2'] }),
      { tokensRepository: { getTokens } },
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

    renderHookWithProviders(() => useFetchAccountTokenOwnership(), {
      activePublicKey: null,
      tokensRepository: { getTokens },
    });

    expect(getTokens).not.toHaveBeenCalled();
  });
});

describe('useFetchTokenBalance', () => {
  it('picks the balance of the requested contract package', async () => {
    const getTokens = jest
      .fn()
      .mockResolvedValue([makeToken('cph-other', '1'), makeToken('cph-1', '4200')]);

    const { result } = renderHookWithProviders(
      () => useFetchTokenBalance({ contractPackageHash: 'cph-1' }),
      { tokensRepository: { getTokens } },
    );

    await waitFor(() => expect(result.current.data).toBe('4200'));
  });

  it('reports "0" for a token the account has never held', async () => {
    const getTokens = jest.fn().mockResolvedValue([]);

    const { result } = renderHookWithProviders(
      () => useFetchTokenBalance({ contractPackageHash: 'cph-1' }),
      { tokensRepository: { getTokens } },
    );

    await waitFor(() => expect(result.current.data).toBe('0'));
  });

  it('stays undefined until the request resolves, so callers can tell empty from unknown', () => {
    const getTokens = jest.fn().mockReturnValue(new Promise(() => {}));

    const { result } = renderHookWithProviders(
      () => useFetchTokenBalance({ contractPackageHash: 'cph-1' }),
      { tokensRepository: { getTokens } },
    );

    expect(result.current.data).toBeUndefined();
  });

  it('requests only the one package it was asked about', async () => {
    const getTokens = jest.fn().mockResolvedValue([]);

    const { result } = renderHookWithProviders(
      () => useFetchTokenBalance({ contractPackageHash: 'cph-1' }),
      { tokensRepository: { getTokens } },
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

    const { result } = renderHookWithProviders(() => useFetchCsprFiatRates(), {
      tokensRepository: { getCsprFiatCurrencyRate },
    });

    await waitFor(() => expect(result.current.csprFiatRates).toBe(0.0123));
    expect(getCsprFiatCurrencyRate).toHaveBeenCalledWith({ network: 'mainnet' });
  });

  it('fetches the rate even with no account connected', async () => {
    const getCsprFiatCurrencyRate = jest.fn().mockResolvedValue({ rate: 1, currency: 'USD' });

    const { result } = renderHookWithProviders(() => useFetchCsprFiatRates(), {
      activePublicKey: null,
      tokensRepository: { getCsprFiatCurrencyRate },
    });

    await waitFor(() => expect(result.current.csprFiatRates).toBe(1));
  });
});
