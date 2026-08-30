/**
 * @jest-environment jsdom
 */
import { renderHook } from '@testing-library/react';

import { useCsprFeeValidation } from './useCsprFeeValidation';

import { CSPR_NATIVE_TOKEN_ID } from '../../../domain/constants';
import type { IDexToken } from '../../../domain/swap';
import type { ISelectedTokensState, ITokenAmountsState } from './useTokenPairState';

const FEE = '2500000000'; // 2.5 CSPR
const AMOUNT = '10000000000'; // 10 CSPR

const getRawBalance = (balance: string) => (tokenId: string) =>
  tokenId === CSPR_NATIVE_TOKEN_ID ? balance : '0';

const csprFirst = (raw: string) => ({
  selectedTokens: { first: { id: CSPR_NATIVE_TOKEN_ID } as IDexToken, second: null },
  tokenAmounts: { first: { formatted: '10', raw }, second: { formatted: '0', raw: '0' } },
});

describe('useCsprFeeValidation', () => {
  describe('no-pair flow (csprAmountInMotes)', () => {
    it.each([
      { balance: '12500000000', expected: false, why: 'balance exactly covers amount + fee' },
      { balance: '99000000000', expected: false, why: 'balance comfortably covers amount + fee' },
      { balance: '12499999999', expected: true, why: 'balance is one mote short' },
      { balance: '0', expected: true, why: 'no balance at all' },
    ])('returns $expected when the $why', ({ balance, expected }) => {
      const { result } = renderHook(() =>
        useCsprFeeValidation({
          getRawBalance: getRawBalance(balance),
          feeInMotes: FEE,
          csprAmountInMotes: AMOUNT,
          isWalletConnected: true,
        }),
      );

      expect(result.current()).toBe(expected);
    });
  });

  describe('swap flow (selectedTokens + tokenAmounts)', () => {
    it('counts the CSPR being swapped, not just the fee, when CSPR is the input token', () => {
      // Covers the fee twice over, but not the fee plus the 10 CSPR being swapped.
      const { result } = renderHook(() =>
        useCsprFeeValidation({
          getRawBalance: getRawBalance('5000000000'),
          feeInMotes: FEE,
          isWalletConnected: true,
          ...csprFirst(AMOUNT),
        }),
      );

      expect(result.current()).toBe(true);
    });

    it('accepts the same balance once the swap amount is covered too', () => {
      const { result } = renderHook(() =>
        useCsprFeeValidation({
          getRawBalance: getRawBalance('12500000000'),
          feeInMotes: FEE,
          isWalletConnected: true,
          ...csprFirst(AMOUNT),
        }),
      );

      expect(result.current()).toBe(false);
    });

    it('checks the fee alone when CSPR is not the input token', () => {
      const selectedTokens = {
        first: { id: 'tokA' } as IDexToken,
        second: null,
      } as ISelectedTokensState;
      const tokenAmounts = {
        first: { formatted: '10', raw: AMOUNT },
        second: { formatted: '0', raw: '0' },
      } as ITokenAmountsState;

      const { result } = renderHook(() =>
        useCsprFeeValidation({
          getRawBalance: getRawBalance(FEE),
          feeInMotes: FEE,
          isWalletConnected: true,
          selectedTokens,
          tokenAmounts,
        }),
      );

      expect(result.current()).toBe(false);
    });
  });

  it('reports no shortfall while the wallet is disconnected', () => {
    const { result } = renderHook(() =>
      useCsprFeeValidation({
        getRawBalance: getRawBalance('0'),
        feeInMotes: FEE,
        csprAmountInMotes: AMOUNT,
        isWalletConnected: false,
      }),
    );

    expect(result.current()).toBe(false);
  });
});
