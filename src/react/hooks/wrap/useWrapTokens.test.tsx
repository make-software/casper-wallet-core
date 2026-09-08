/**
 * @jest-environment jsdom
 */
import { act, waitFor } from '@testing-library/react';

import { useWrapTokens } from './useWrapTokens';

import {
  renderHookWithQueryClient,
  stubSwapRepository,
  stubTokensRepository,
  TEST_PUBLIC_KEY,
} from '../../../__test-utils__/render-hook';
import { WrappedCsprContractPackageHash } from '../../../domain/constants';
import type { IDexToken } from '../../../domain/swap';
import type { ICsprBalance, ITokenWithFiatBalance } from '../../../domain/tokens';

const WCSPR = WrappedCsprContractPackageHash.mainnet;

const makeDeps = ({
  liquidBalance = '100000000000', // 100 CSPR
  wcsprBalance = '50000000000', // 50 WCSPR
}: { liquidBalance?: string; wcsprBalance?: string } = {}) => ({
  network: 'mainnet' as const,
  activePublicKey: TEST_PUBLIC_KEY,
  tokensRepository: stubTokensRepository({
    getCsprBalance: jest.fn().mockResolvedValue({ liquidBalance } as ICsprBalance),
    getTokens: jest
      .fn()
      .mockResolvedValue([
        { contractPackageHash: WCSPR, balance: wcsprBalance, decimals: 9 } as ITokenWithFiatBalance,
      ]),
  }),
  swapRepository: stubSwapRepository({
    getDexTokens: jest
      .fn()
      .mockResolvedValue([
        { id: 'cspr', packageHash: WCSPR, decimals: 9, symbol: 'CSPR' } as IDexToken,
      ]),
  }),
});

const render = (deps: ReturnType<typeof makeDeps>) =>
  renderHookWithQueryClient(() => useWrapTokens(deps));

describe('useWrapTokens', () => {
  it('starts in the wrap direction and switches', async () => {
    const { result } = render(makeDeps());

    expect(result.current.direction).toBe('wrap');

    await act(async () => {
      result.current.switchDirection();
    });

    expect(result.current.direction).toBe('unwrap');
  });

  describe('CSPR fee validation', () => {
    // Wrapping spends native CSPR; unwrapping burns WCSPR and needs CSPR only for the fee.
    // Dropping the direction check would demand liquid CSPR equal to the WCSPR being unwrapped,
    // so a user holding WCSPR and little CSPR could never unwrap.
    it('counts the amount being wrapped against the CSPR balance', async () => {
      const { result } = render(makeDeps({ liquidBalance: '10000000000' })); // 10 CSPR

      await act(async () => {
        result.current.updateAmount('9');
      });

      // 9 CSPR to wrap + 5 CSPR fee > 10 CSPR held.
      await waitFor(() => expect(result.current.isInsufficientCsprForFees()).toBe(true));
    });

    it('counts only the fee when unwrapping', async () => {
      const { result } = render(
        makeDeps({ liquidBalance: '10000000000', wcsprBalance: '50000000000' }),
      );

      await act(async () => {
        result.current.switchDirection();
      });
      await act(async () => {
        result.current.updateAmount('9');
      });

      // The same 9 against the same 10 CSPR, but the 9 comes out of WCSPR.
      await waitFor(() => expect(result.current.isInsufficientCsprForFees()).toBe(false));
    });
  });

  describe('source balance', () => {
    it('reads the native CSPR balance when wrapping', async () => {
      const { result } = render(makeDeps());

      await waitFor(() => expect(result.current.getTokenBalance('first')).toBe('100'));
    });

    // Resolving this against the ownership-keyed map instead of the WCSPR fetch returns '0',
    // and isAmountExceedsBalance then blocks every unwrap.
    it('reads the WCSPR balance when unwrapping', async () => {
      const { result } = render(makeDeps());

      await act(async () => {
        result.current.switchDirection();
      });

      await waitFor(() => expect(result.current.getTokenBalance('first')).toBe('50'));
    });

    it('does not report an unwrap within the WCSPR balance as exceeding it', async () => {
      const { result } = render(makeDeps());

      await act(async () => {
        result.current.switchDirection();
      });
      await act(async () => {
        result.current.updateAmount('40');
      });

      await waitFor(() => expect(result.current.isAmountExceedsBalance('first')).toBe(false));
    });

    it('reports an unwrap beyond the WCSPR balance as exceeding it', async () => {
      const { result } = render(makeDeps());

      await act(async () => {
        result.current.switchDirection();
      });
      await act(async () => {
        result.current.updateAmount('60');
      });

      await waitFor(() => expect(result.current.isAmountExceedsBalance('first')).toBe(true));
    });
  });

  it('derives sourceRawAmount from the typed amount, not from a balance', async () => {
    const { result } = render(makeDeps());

    await act(async () => {
      result.current.updateAmount('1.5');
    });

    expect(result.current.sourceRawAmount).toBe('1500000000');
  });
});
