import { useCallback } from 'react';

import type { ISelectedTokensState, ITokenAmountsState } from './useTokenPairState';

import { CSPR_NATIVE_TOKEN_ID } from '../../../domain/constants';
import { hasEnoughCSPRBalance } from '../../../utils/amounts';

interface IUseCsprFeeValidationParams {
  getRawBalance: (tokenId: string) => string;
  feeInMotes: string;
  isWalletConnected: boolean;

  // Optional: use when there's no token pair (e.g. withdraw flow)
  csprAmountInMotes?: string;

  // Optional: use when there's a token pair (swap)
  selectedTokens?: ISelectedTokensState;
  tokenAmounts?: ITokenAmountsState;
}

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
