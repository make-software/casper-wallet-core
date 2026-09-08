import type { ISelectedTokensState } from './useTokenPairState';

interface IUseTokenWarningsReturn {
  unlistedTokens: NonNullable<ISelectedTokensState['first']>[];
  blacklistedTokens: NonNullable<ISelectedTokensState['first']>[];
  blacklistedMessage: string | null;
  unlistedMessage: string | null;
  hasUnlistedTokens: boolean;
}

export const useTokenWarnings = (
  selectedTokens: ISelectedTokensState,
  context: 'swap' | 'add-liquidity',
): IUseTokenWarningsReturn => {
  const blacklistedTokens = [
    selectedTokens.first?.isBlacklisted === true ? selectedTokens.first : null,
    selectedTokens.second?.isBlacklisted === true ? selectedTokens.second : null,
  ].filter(Boolean) as NonNullable<ISelectedTokensState['first']>[];

  const unlistedTokens = [
    selectedTokens.first &&
    !selectedTokens.first.isWhitelisted &&
    !selectedTokens.first.isBlacklisted
      ? selectedTokens.first
      : null,
    selectedTokens.second &&
    !selectedTokens.second.isWhitelisted &&
    !selectedTokens.second.isBlacklisted
      ? selectedTokens.second
      : null,
  ].filter(Boolean) as NonNullable<ISelectedTokensState['first']>[];

  const action = context === 'swap' ? 'trading' : 'adding liquidity';
  const pairLabel = context === 'swap' ? 'trading pair' : 'token pair';

  const blacklistedMessage =
    blacklistedTokens.length === 2
      ? `${blacklistedTokens[0].symbol} and ${blacklistedTokens[1].symbol} are not available for ${action}. Please select a different ${pairLabel}.`
      : blacklistedTokens.length === 1
        ? `Token ${blacklistedTokens[0].symbol} is not available for ${action}. Please select a different ${pairLabel}.`
        : null;

  const unlistedMessage =
    unlistedTokens.length > 0
      ? context === 'swap'
        ? 'You are trading an unlisted token. Verify the contract address carefully, and proceed only if you understand the risks.'
        : 'You are adding liquidity to a pool with an unlisted token. Please confirm the token details before depositing.'
      : null;

  return {
    unlistedTokens,
    blacklistedTokens,
    blacklistedMessage,
    unlistedMessage,
    hasUnlistedTokens: unlistedTokens.length > 0,
  };
};
