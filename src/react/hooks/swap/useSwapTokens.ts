import { useCallback, useEffect, useMemo } from 'react';

import { useSwapRouteTokens } from './useSwapRouteTokens';

import { useFetchDexTokens } from '../api/useFetchDexTokens';
import { useFetchSwapQuote } from '../api/useFetchSwapQuote';
import { useContractSettings } from '../context/useContractSettings';
import { useRepositories } from '../context/useRepositories';
import { useCsprFeeValidation } from '../token/useCsprFeeValidation';
import { useTokenBalances } from '../token/useTokenBalances';
import { useTokenPairBalances } from '../token/useTokenPairBalances';
import { useTokenPairFiatAmounts } from '../token/useTokenPairFiatAmounts';
import { useTokenPairState } from '../token/useTokenPairState';
import { useTokenPreselection } from '../token/useTokenPreselection';

import {
  CSPR_NATIVE_TOKEN_ID,
  DEX_PAYMENT_AMOUNT,
  TOKEN_DISPLAY_DECIMALS,
  USD_CURRENCY_CODE,
} from '../../../domain/constants';
import type { IDexToken } from '../../../domain/swap';
import { SwapQuoteType } from '../../../domain/swap';
import { isAmountInputValid, isPositiveAmount } from '../../../utils/amounts';
import { formatTokenBalance, getBlockchainAmount } from '../../../utils/common';
import {
  calculateMaxUsableBalance,
  calculateSwapFee,
  calculateSwapPaymentAmount,
  handleTokenSelection,
  type TokenPosition,
} from '../../../utils/swap';

export interface IUseSwapTokensParams {
  tokenInHash?: string; // deep-link token hashes; router/URL parsing is the consumer's job
  tokenOutHash?: string;
}

/**
 * Trade-page orchestrator: composes token-pair state, balances, quote fetching and the review
 * modal into one form API. Return-field names are public API for the apps consuming this library.
 */
export const useSwapTokens = ({ tokenInHash, tokenOutHash }: IUseSwapTokensParams = {}) => {
  const { activePublicKey } = useRepositories();
  const { slippage } = useContractSettings();
  const isWalletConnected = Boolean(activePublicKey);

  const { data: tokens } = useFetchDexTokens();

  const {
    selectedTokens,
    tokenAmounts,
    activeTokenPosition,
    hasBothTokens,
    debouncedTokenAmounts,
    tokensWithAmounts,
    customTokenHashes,
    setSelectedTokens,
    setTokenAmounts,
    setActiveTokenPosition,
    setInitialTokens,
    resetToDefaultTokens,
    tokenSelectorModal,
    reviewModal,
  } = useTokenPairState({ tokens });

  const {
    getFormattedBalance,
    getRawBalance,
    resetBalances,
    refetchCsprBalance,
    refetchTokenBalances,
  } = useTokenBalances({ additionalContractPackageHashes: customTokenHashes });

  const quoteType =
    activeTokenPosition === 'first' ? SwapQuoteType.ExactIn : SwapQuoteType.ExactOut;

  const { firstTokenFiatAmount, secondTokenFiatAmount, csprFiatRates } = useTokenPairFiatAmounts({
    firstToken: selectedTokens.first,
    secondToken: selectedTokens.second,
    firstTokenAmount: tokenAmounts.first.formatted || '0',
    secondTokenAmount: tokenAmounts.second.formatted || '0',
  });

  const rawAmount = useMemo(() => {
    const isFirst = activeTokenPosition === 'first';
    const token = isFirst ? selectedTokens.first : selectedTokens.second;
    const formatted = isFirst
      ? debouncedTokenAmounts.first.formatted
      : debouncedTokenAmounts.second.formatted;

    if (!token) return '0';

    return formatted && typeof token.decimals === 'number'
      ? getBlockchainAmount(formatted, token.decimals, '0')
      : '0';
  }, [activeTokenPosition, debouncedTokenAmounts, selectedTokens.first, selectedTokens.second]);

  const quoteData = useFetchSwapQuote({
    tokenIn: tokenSelectorModal.isOpen ? null : selectedTokens.first,
    tokenOut: tokenSelectorModal.isOpen ? null : selectedTokens.second,
    amount: rawAmount,
    type_id: quoteType,
  });

  const { getTokenBalance, getRawTokenBalance, isAmountExceedsBalance } = useTokenPairBalances({
    selectedTokens,
    tokenAmounts,
    getFormattedBalance,
    getRawBalance,
    isWalletConnected,
  });

  const getMaxUsableBalance = useCallback(
    (position: TokenPosition): string => {
      const token = selectedTokens[position];
      if (!token) return '0';

      const balance = getTokenBalance(position);

      return calculateMaxUsableBalance({
        balance,
        symbol: token.symbol,
        context: 'swap',
      });
    },
    [selectedTokens, getTokenBalance],
  );

  const transactionFeeInMotes = useMemo(() => {
    const isSwappingTokenForToken =
      selectedTokens.first?.id !== CSPR_NATIVE_TOKEN_ID &&
      selectedTokens.second?.id !== CSPR_NATIVE_TOKEN_ID;
    const swapFee = isSwappingTokenForToken
      ? DEX_PAYMENT_AMOUNT.swapTokenForToken
      : DEX_PAYMENT_AMOUNT.swapCsprForToken;

    return (BigInt(DEX_PAYMENT_AMOUNT.approve) + BigInt(swapFee)).toString();
  }, [selectedTokens.first?.id, selectedTokens.second?.id]);

  const isInsufficientCsprForFees = useCsprFeeValidation({
    selectedTokens,
    tokenAmounts,
    getRawBalance,
    feeInMotes: transactionFeeInMotes,
    isWalletConnected,
  });

  const isAmountEntered = isPositiveAmount(tokenAmounts.first.formatted);

  const isFormValid = Boolean(
    selectedTokens.first &&
    selectedTokens.second &&
    !selectedTokens.first.isBlacklisted &&
    !selectedTokens.second.isBlacklisted &&
    isPositiveAmount(tokenAmounts.first.formatted) &&
    isPositiveAmount(tokenAmounts.second.formatted) &&
    !isAmountExceedsBalance('first') &&
    !isInsufficientCsprForFees() &&
    quoteData.data,
  );

  const openTokenSelector = useCallback(
    (position: TokenPosition) => {
      setActiveTokenPosition(position);
      tokenSelectorModal.open();
    },
    [setActiveTokenPosition, tokenSelectorModal],
  );

  const selectToken = useCallback(
    (token: IDexToken) => {
      setSelectedTokens(prev => handleTokenSelection(prev, token, activeTokenPosition));

      if (activeTokenPosition === 'first') {
        setTokenAmounts({
          first: { formatted: '0', raw: '0' },
          second: { formatted: '0', raw: '0' },
        });
      } else {
        setTokenAmounts(prev => ({ first: prev.first, second: { formatted: '0', raw: '0' } }));
        setActiveTokenPosition('first');
      }

      tokenSelectorModal.close();
    },
    [
      activeTokenPosition,
      setActiveTokenPosition,
      setSelectedTokens,
      setTokenAmounts,
      tokenSelectorModal,
    ],
  );

  const handleSwitchTokens = useCallback(() => {
    const nextFirstToken = selectedTokens.second;
    setSelectedTokens(prev => ({ first: prev.second, second: prev.first }));
    setActiveTokenPosition('first');

    setTokenAmounts(prev => ({
      first: {
        formatted: prev.first.formatted,
        raw: nextFirstToken?.decimals
          ? getBlockchainAmount(prev.first.formatted, nextFirstToken.decimals, '0')
          : prev.first.raw,
      },
      second: { formatted: '0', raw: '0' },
    }));
  }, [selectedTokens.second, setActiveTokenPosition, setSelectedTokens, setTokenAmounts]);

  const updateAmount = useCallback(
    (position: TokenPosition, amount: string) => {
      const currentToken = selectedTokens[position];
      const currentDecimals = currentToken?.decimals;

      if (amount !== '' && !isAmountInputValid(amount, currentDecimals)) {
        return;
      }

      setTokenAmounts(prev => {
        const formatted = amount;
        const raw =
          amount && typeof currentDecimals === 'number'
            ? getBlockchainAmount(formatted, currentDecimals, '0')
            : '0';

        const next = { ...prev, [position]: { formatted, raw } };

        if (amount === '' || amount === '0') {
          return {
            first: { formatted: '0', raw: '0' },
            second: { formatted: '0', raw: '0' },
          };
        }

        return next;
      });

      setActiveTokenPosition(position);
    },
    [selectedTokens, setActiveTokenPosition, setTokenAmounts],
  );

  useEffect(() => {
    if (
      selectedTokens.first &&
      selectedTokens.second &&
      quoteData.data?.amountInDecimal &&
      quoteData.data?.amountOutDecimal
    ) {
      if (activeTokenPosition === 'first') {
        const formatted = quoteData.data.amountOutDecimal;
        const raw =
          typeof selectedTokens.second.decimals === 'number'
            ? getBlockchainAmount(formatted, selectedTokens.second.decimals, '0')
            : '0';

        setTokenAmounts(prev => ({ ...prev, second: { formatted, raw } }));
      } else {
        const formatted = quoteData.data.amountInDecimal;
        const raw =
          typeof selectedTokens.first.decimals === 'number'
            ? getBlockchainAmount(formatted, selectedTokens.first.decimals, '0')
            : '0';

        setTokenAmounts(prev => ({ ...prev, first: { formatted, raw } }));
      }
    }
  }, [
    setTokenAmounts,
    activeTokenPosition,
    quoteData.data?.amountInDecimal,
    quoteData.data?.amountOutDecimal,
    selectedTokens.first,
    selectedTokens.second,
  ]);

  const openReviewModal = useCallback(async () => {
    if (!tokensWithAmounts.first || !tokensWithAmounts.second) {
      return;
    }

    reviewModal.open();
  }, [tokensWithAmounts, reviewModal]);

  const onSwapSuccess = useCallback(() => {
    setTokenAmounts({
      first: { formatted: '0', raw: '0' },
      second: { formatted: '0', raw: '0' },
    });
    refetchCsprBalance().catch(() => {
      // best-effort background refresh; consumers can retry via the returned refetchCsprBalance
    });
    refetchTokenBalances().catch(() => {
      // best-effort background refresh; consumers can retry via the returned refetchTokenBalances
    });
  }, [refetchCsprBalance, refetchTokenBalances, setTokenAmounts]);

  const resetForm = useCallback(() => {
    resetToDefaultTokens();
    resetBalances();
  }, [resetBalances, resetToDefaultTokens]);

  const quoteFirstSymbol =
    activeTokenPosition === 'first' ? selectedTokens.first?.symbol : selectedTokens.second?.symbol;
  const quoteSecondSymbol =
    activeTokenPosition === 'first' ? selectedTokens.second?.symbol : selectedTokens.first?.symbol;

  const quote =
    selectedTokens.first && selectedTokens.second && quoteData.data?.rate
      ? `1 ${quoteFirstSymbol} = ${formatTokenBalance(quoteData.data.rate, 0, TOKEN_DISPLAY_DECIMALS, '0', true)} ${quoteSecondSymbol}`
      : null;

  const priceImpact = quoteData.data?.price_impact
    ? Number(quoteData.data.price_impact).toFixed(2)
    : null;
  const protocolFee = selectedTokens.first
    ? `${calculateSwapFee(tokenAmounts.first.formatted)} ${selectedTokens.first.symbol}`
    : null;

  const networkCost = calculateSwapPaymentAmount(
    selectedTokens.first,
    selectedTokens.second,
    csprFiatRates ?? null,
    USD_CURRENCY_CODE,
  );
  const maxSlippage = `${slippage}`;
  const swapRoutes = useSwapRouteTokens(quoteData.data?.path ?? [], tokens ?? []);
  const path = quoteData.data?.path ?? [];

  // `setInitialTokens` takes `(first, second)`; `useTokenPreselection` passes a single
  // `{ first, second }` object — adapt here rather than changing either hook's signature.
  const setInitialTokensForPreselection = useCallback(
    (nextTokens: { first: IDexToken | null; second: IDexToken | null }) => {
      if (!nextTokens.first) return;

      setInitialTokens(nextTokens.first, nextTokens.second);
    },
    [setInitialTokens],
  );

  useTokenPreselection({
    tokenInHash,
    tokenOutHash,
    tokens: tokens ?? [],
    setInitialTokens: setInitialTokensForPreselection,
    setSelectedTokens,
  });

  return {
    // State
    selectedTokens,
    tokenAmounts,
    isTokenSelectorOpen: tokenSelectorModal.isOpen,
    isReviewModalOpen: reviewModal.isOpen,
    activeTokenPosition,

    // Computed values
    isFormValid,
    isAmountEntered,
    hasTokensSelected: hasBothTokens,

    // Actions
    openTokenSelector,
    closeTokenSelector: tokenSelectorModal.close,
    selectToken,
    updateAmount,
    resetForm,
    onSwapSuccess,
    openReviewModal,
    closeReviewModal: reviewModal.close,
    handleSwitchTokens,

    // Validation helpers
    getTokenBalance,
    getRawTokenBalance,
    isAmountExceedsBalance,
    isInsufficientCsprForFees,
    getMaxUsableBalance,

    // Quote data and calculations
    quoteData,
    quote,
    priceImpact,
    protocolFee,
    networkCost,
    maxSlippage,
    swapRoutes,
    path,
    quoteType,
    firstTokenFiatAmount,
    secondTokenFiatAmount,
    tokens,
    setInitialTokens,
  };
};
