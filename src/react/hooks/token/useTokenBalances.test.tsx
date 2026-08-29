/**
 * @jest-environment jsdom
 */
import { act, waitFor } from '@testing-library/react';

import { useTokenBalances } from './useTokenBalances';

import { renderHookWithProviders, TEST_PUBLIC_KEY } from '../../../__test-utils__/render-hook';
import type { IDexToken } from '../../../domain/swap';
import type { ICsprBalance, ITokenWithFiatBalance } from '../../../domain/tokens';

const makeDexToken = (packageHash: string): IDexToken =>
  ({ id: packageHash, packageHash, decimals: 9 }) as IDexToken;

const makeHeldToken = (
  contractPackageHash: string,
  balance: string,
  decimals = 9,
): ITokenWithFiatBalance => ({ contractPackageHash, balance, decimals }) as ITokenWithFiatBalance;

const makeCsprBalance = (over: Partial<ICsprBalance> = {}): ICsprBalance =>
  ({
    totalBalance: '900000000000',
    liquidBalance: '1000000000',
    delegatedBalance: '899000000000',
    ...over,
  }) as ICsprBalance;

const csprOnly = (getCsprBalance: jest.Mock) => ({
  tokensRepository: { getCsprBalance, getTokens: jest.fn().mockResolvedValue([]) },
  swapRepository: { getDexTokens: jest.fn().mockResolvedValue([]) },
});

describe('useTokenBalances', () => {
  it('reports the spendable CSPR balance, not the total that includes stake', async () => {
    const getCsprBalance = jest.fn().mockResolvedValue(makeCsprBalance());

    const { result } = renderHookWithProviders(() => useTokenBalances(), csprOnly(getCsprBalance));

    await waitFor(() => expect(result.current.getRawBalance('cspr')).toBe('1000000000'));
    expect(getCsprBalance).toHaveBeenCalledWith({
      network: 'mainnet',
      publicKey: TEST_PUBLIC_KEY,
    });
  });

  it('formats the CSPR balance against CSPR decimals', async () => {
    const getCsprBalance = jest
      .fn()
      .mockResolvedValue(makeCsprBalance({ liquidBalance: '2500000000' }));

    const { result } = renderHookWithProviders(() => useTokenBalances(), csprOnly(getCsprBalance));

    await waitFor(() => expect(result.current.getFormattedBalance('cspr')).toBe('2.5'));
  });

  it('keys CEP-18 balances by contract package hash and formats them by token decimals', async () => {
    const getTokens = jest
      .fn()
      .mockResolvedValue([makeHeldToken('cph-1', '1500000', 6), makeHeldToken('cph-2', '0')]);

    const { result } = renderHookWithProviders(() => useTokenBalances(), {
      tokensRepository: {
        getCsprBalance: jest.fn().mockResolvedValue(makeCsprBalance()),
        getTokens,
      },
      swapRepository: {
        getDexTokens: jest.fn().mockResolvedValue([makeDexToken('cph-1'), makeDexToken('cph-2')]),
      },
    });

    await waitFor(() => expect(result.current.getRawBalance('cph-1')).toBe('1500000'));
    expect(result.current.getFormattedBalance('cph-1')).toBe('1.5');
    expect(result.current.getRawBalance('cph-2')).toBe('0');
  });

  it('reports "0" for a token that was never fetched', async () => {
    const getCsprBalance = jest.fn().mockResolvedValue(makeCsprBalance());

    const { result } = renderHookWithProviders(() => useTokenBalances(), csprOnly(getCsprBalance));

    await waitFor(() => expect(result.current.getRawBalance('cspr')).toBe('1000000000'));
    expect(result.current.getRawBalance('never-fetched')).toBe('0');
    expect(result.current.getFormattedBalance('never-fetched')).toBe('0');
  });

  it('leaves balances empty and skips the request when no account is connected', async () => {
    const getCsprBalance = jest.fn();

    const { result } = renderHookWithProviders(() => useTokenBalances(), {
      activePublicKey: null,
      ...csprOnly(getCsprBalance),
    });

    await waitFor(() => expect(result.current.tokenBalances.raw).toEqual({}));
    expect(getCsprBalance).not.toHaveBeenCalled();
  });

  it('re-reads the CSPR balance when asked to refetch', async () => {
    const getCsprBalance = jest
      .fn()
      .mockResolvedValueOnce(makeCsprBalance({ liquidBalance: '1000000000' }))
      .mockResolvedValueOnce(makeCsprBalance({ liquidBalance: '7000000000' }));

    const { result } = renderHookWithProviders(() => useTokenBalances(), csprOnly(getCsprBalance));

    await waitFor(() => expect(result.current.getRawBalance('cspr')).toBe('1000000000'));

    await act(async () => {
      await result.current.refetchCsprBalance();
    });

    expect(result.current.getRawBalance('cspr')).toBe('7000000000');
  });

  it('survives a failing CSPR read without rejecting into the caller', async () => {
    const getCsprBalance = jest.fn().mockRejectedValue(new Error('api down'));

    const { result } = renderHookWithProviders(() => useTokenBalances(), csprOnly(getCsprBalance));

    await waitFor(() => expect(getCsprBalance).toHaveBeenCalled());
    expect(result.current.getRawBalance('cspr')).toBe('0');
  });
});
