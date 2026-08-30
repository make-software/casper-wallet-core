import { useCallback } from 'react';

import type { ISelectedTokensState, ITokenAmountsState } from './useTokenPairState';

import { CSPR_NATIVE_TOKEN_ID } from '../../../domain/constants';
import { hasEnoughCSPRBalance } from '../../../utils/amounts';

interface IUseCsprFeeValidationBase {
  getRawBalance: (tokenId: string) => string;
  feeInMotes: string;
  isWalletConnected: boolean;
}

/**
 * The two modes are exclusive and one of them is mandatory. Supplying neither used to
 * type-check and silently validate against an amount of `'0'` — gas only — so a user swapping
 * their whole CSPR balance passed a check that never looked at the balance being spent.
 */
type IUseCsprFeeValidationParams = IUseCsprFeeValidationBase &
  (
    | {
        /** No token pair (e.g. wrap/unwrap): the CSPR being spent, in motes. */
        csprAmountInMotes: string;
        selectedTokens?: never;
        tokenAmounts?: never;
      }
    | {
        csprAmountInMotes?: never;
        /** Token pair (swap): the CSPR leg is read from the pair when it is the input token. */
        selectedTokens: ISelectedTokensState;
        tokenAmounts: ITokenAmountsState;
      }
  );

export const useCsprFeeValidation = ({
  selectedTokens,
  tokenAmounts,
  getRawBalance,
  feeInMotes,
  csprAmountInMotes,
  isWalletConnected,
}: IUseCsprFeeValidationParams) => {
  return useCallback((): boolean => {
    if (!isWalletConnected) return false;

    const csprRawBalance = getRawBalance(CSPR_NATIVE_TOKEN_ID);

    const amountInMotes =
      csprAmountInMotes ??
      (selectedTokens?.first?.id === CSPR_NATIVE_TOKEN_ID
        ? (tokenAmounts?.first?.raw ?? '0')
        : '0');

    return !hasEnoughCSPRBalance(csprRawBalance, amountInMotes, feeInMotes);
  }, [
    isWalletConnected,
    getRawBalance,
    selectedTokens,
    tokenAmounts,
    feeInMotes,
    csprAmountInMotes,
  ]);
};
