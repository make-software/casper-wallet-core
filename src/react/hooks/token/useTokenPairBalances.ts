import { useCallback } from 'react';

import type { ISelectedTokensState, ITokenAmountsState } from './useTokenPairState';

import { doesAmountExceedBalance } from '../../../utils/amounts';
import type { TokenPosition } from '../../../utils/swap';

interface IUseTokenPairBalancesParams {
  selectedTokens: ISelectedTokensState;
  tokenAmounts: ITokenAmountsState;
  getFormattedBalance: (tokenId: string) => string;
  getRawBalance: (tokenId: string) => string;
  isWalletConnected: boolean;
}

export const useTokenPairBalances = ({
  selectedTokens,
  tokenAmounts,
  getFormattedBalance,
  getRawBalance,
  isWalletConnected,
}: IUseTokenPairBalancesParams) => {
  const getTokenBalance = useCallback(
    (position: TokenPosition): string => {
      const token = selectedTokens[position];

      if (!token) return '0';

      return getFormattedBalance(token.id);
    },
    [selectedTokens, getFormattedBalance],
  );

  const getRawTokenBalance = useCallback(
    (position: TokenPosition): string => {
      const token = selectedTokens[position];

      if (!token) return '0';

      return getRawBalance(token.id);
    },
    [selectedTokens, getRawBalance],
  );

  const isAmountExceedsBalance = useCallback(
    (position: TokenPosition): boolean => {
      if (!isWalletConnected) return false;

      const token = selectedTokens[position];
      const amountRaw = tokenAmounts[position].raw;

      if (!token) return false;

      const balanceRaw = getRawTokenBalance(position);

      return doesAmountExceedBalance(amountRaw, balanceRaw);
    },
    [isWalletConnected, selectedTokens, tokenAmounts, getRawTokenBalance],
  );

  return {
    getTokenBalance,
    getRawTokenBalance,
    isAmountExceedsBalance,
  };
};
