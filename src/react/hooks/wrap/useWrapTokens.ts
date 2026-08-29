import { useCallback, useMemo, useState } from 'react';

import { useFetchDexTokens } from '../api/useFetchDexTokens';
import { useFetchTokenBalance } from '../api/useFetchTokenBalance';
import { useCsprFeeValidation } from '../token/useCsprFeeValidation';
import { useTokenBalances } from '../token/useTokenBalances';
import { useTokenPairBalances } from '../token/useTokenPairBalances';
import { useTokenPairFiatAmounts } from '../token/useTokenPairFiatAmounts';
import { useModalState } from '../ui/useModalState';

import {
  CSPR_COIN,
  CSPR_DECIMALS,
  CSPR_NATIVE_TOKEN_ID,
  DEX_PAYMENT_AMOUNT,
  WrappedCsprContractPackageHash,
} from '../../../domain/constants';
import type { WrapDirection } from '../../../domain/dex';
import type { IDexToken } from '../../../domain/swap';
import { isAmountInputValid, isPositiveAmount } from '../../../utils/amounts';
import { getBlockchainAmount, getDecimalTokenBalance } from '../../../utils/common';
import type { ISwapDependencies } from '../../types';

const buildNativeCsprToken = (csprFromList: IDexToken | undefined): IDexToken => ({
  id: CSPR_NATIVE_TOKEN_ID,
  name: CSPR_COIN.name,
  symbol: CSPR_COIN.symbol,
  icon: csprFromList?.icon ?? null,
  decimals: CSPR_DECIMALS,
  packageHash: '',
  isWhitelisted: true,
  isBlacklisted: false,
  fiatRates: csprFromList?.fiatRates ?? null,
  totalValueLocked: null,
  volume24h: null,
});

const buildWcsprToken = (
  csprFromList: IDexToken | undefined,
  wrappedCsprPackageHash: string,
): IDexToken => ({
  id: wrappedCsprPackageHash,
  name: 'Wrapped Casper',
  symbol: 'WCSPR',
  icon: csprFromList?.icon ?? null,
  decimals: CSPR_DECIMALS,
  packageHash: wrappedCsprPackageHash,
  isWhitelisted: true,
  isBlacklisted: false,
  fiatRates: csprFromList?.fiatRates ?? null,
  totalValueLocked: null,
  volume24h: null,
});

export interface IUseWrapTokensParams extends Pick<
  ISwapDependencies,
  'network' | 'activePublicKey' | 'swapRepository' | 'tokensRepository'
> {}

/**
 * WCSPR page orchestrator: wrap/unwrap direction, amount, both legs' balances and the review
 * modal.
 */
export const useWrapTokens = ({
  network,
  activePublicKey,
  swapRepository,
  tokensRepository,
}: IUseWrapTokensParams) => {
  const isWalletConnected = Boolean(activePublicKey);

  const wrappedCsprPackageHash = WrappedCsprContractPackageHash[network];

  const { data: tokens } = useFetchDexTokens({ network, swapRepository });

  const [direction, setDirection] = useState<WrapDirection>('wrap');
  const [amount, setAmount] = useState<string>('0');

  const reviewModal = useModalState(false);

  // The token list maps the WCSPR API record to a virtual CSPR token (id='cspr'), so both legs
  // are rebuilt here to let the form target native CSPR and the real WCSPR contract separately.
  const csprFromList = useMemo(
    () => tokens?.find(token => token.id === CSPR_NATIVE_TOKEN_ID),
    [tokens],
  );
  const csprToken = useMemo(() => buildNativeCsprToken(csprFromList), [csprFromList]);
  const wcsprToken = useMemo(
    () => buildWcsprToken(csprFromList, wrappedCsprPackageHash),
    [csprFromList, wrappedCsprPackageHash],
  );

  const sourceToken = direction === 'wrap' ? csprToken : wcsprToken;
  const destinationToken = direction === 'wrap' ? wcsprToken : csprToken;

  const sourceRawAmount = useMemo(() => getBlockchainAmount(amount, CSPR_DECIMALS, '0'), [amount]);

  const { firstTokenFiatAmount: sourceTokenFiatAmount } = useTokenPairFiatAmounts({
    network,
    tokensRepository,
    firstToken: sourceToken,
    secondToken: destinationToken,
    firstTokenAmount: amount,
    secondTokenAmount: amount,
  });

  const { getFormattedBalance, getRawBalance, refetchCsprBalance } = useTokenBalances({
    network,
    activePublicKey,
    tokensRepository,
    swapRepository,
  });

  // Wrapping and unwrapping both move this balance, so the WCSPR leg gets its own fetch and a
  // refetch handle to run right after the transaction.
  const { data: wcsprBalance, refetch: refetchWcsprBalance } = useFetchTokenBalance({
    network,
    activePublicKey,
    tokensRepository,
    contractPackageHash: wrappedCsprPackageHash,
    enabled: isWalletConnected,
  });

  const wcsprRawBalance = useMemo(() => wcsprBalance || '0', [wcsprBalance]);

  const wcsprFormattedBalance = useMemo(
    () => getDecimalTokenBalance(wcsprRawBalance, CSPR_DECIMALS, '0'),
    [wcsprRawBalance],
  );

  const getFormattedBalanceById = useCallback(
    (tokenId: string): string =>
      tokenId === wrappedCsprPackageHash ? wcsprFormattedBalance : getFormattedBalance(tokenId),
    [getFormattedBalance, wcsprFormattedBalance, wrappedCsprPackageHash],
  );

  const getRawBalanceById = useCallback(
    (tokenId: string): string =>
      tokenId === wrappedCsprPackageHash ? wcsprRawBalance : getRawBalance(tokenId),
    [getRawBalance, wcsprRawBalance, wrappedCsprPackageHash],
  );

  const selectedTokens = useMemo(
    () => ({ first: sourceToken, second: destinationToken }),
    [sourceToken, destinationToken],
  );

  const tokenAmounts = useMemo(
    () => ({
      first: { formatted: amount, raw: sourceRawAmount },
      second: { formatted: amount, raw: sourceRawAmount },
    }),
    [amount, sourceRawAmount],
  );

  const { getTokenBalance, getRawTokenBalance, isAmountExceedsBalance } = useTokenPairBalances({
    selectedTokens,
    tokenAmounts,
    getFormattedBalance: getFormattedBalanceById,
    getRawBalance: getRawBalanceById,
    isWalletConnected,
  });

  const feeInMotes = useMemo(
    () => (direction === 'wrap' ? DEX_PAYMENT_AMOUNT.wrap : DEX_PAYMENT_AMOUNT.unwrap),
    [direction],
  );

  const isInsufficientCsprForFees = useCsprFeeValidation({
    getRawBalance: getRawBalanceById,
    feeInMotes,
    // Only wrapping spends native CSPR (the amount being wrapped); unwrapping spends CSPR only
    // for the fee.
    csprAmountInMotes: direction === 'wrap' ? sourceRawAmount : '0',
    isWalletConnected,
  });

  const isAmountEntered = isPositiveAmount(amount);

  const isFormValid = Boolean(
    isAmountEntered && !isAmountExceedsBalance('first') && !isInsufficientCsprForFees(),
  );

  const updateAmount = useCallback((value: string) => {
    if (value !== '' && !isAmountInputValid(value, CSPR_DECIMALS)) {
      return;
    }

    setAmount(value === '' ? '0' : value);
  }, []);

  const switchDirection = useCallback(() => {
    setDirection(prev => (prev === 'wrap' ? 'unwrap' : 'wrap'));
    setAmount('0');
  }, []);

  const resetAmount = useCallback(() => {
    setAmount('0');
  }, []);

  const onWrapSuccess = useCallback(() => {
    resetAmount();

    refetchCsprBalance().catch(() => {
      // best-effort background refresh; consumers can retry via the returned onWrapSuccess
    });
    refetchWcsprBalance().catch(() => {
      // best-effort background refresh; consumers can retry via the returned onWrapSuccess
    });
  }, [resetAmount, refetchCsprBalance, refetchWcsprBalance]);

  return {
    direction,
    amount,
    sourceToken,
    destinationToken,
    sourceRawAmount,
    sourceTokenFiatAmount,
    isFormValid,
    isAmountEntered,
    isReviewModalOpen: reviewModal.isOpen,
    openReviewModal: reviewModal.open,
    closeReviewModal: reviewModal.close,
    updateAmount,
    switchDirection,
    resetAmount,
    onWrapSuccess,
    getTokenBalance,
    getRawTokenBalance,
    isAmountExceedsBalance,
    isInsufficientCsprForFees,
  };
};
