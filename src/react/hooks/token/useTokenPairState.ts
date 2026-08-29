import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useDebounce } from '../ui/useDebounce';
import { useModalState } from '../ui/useModalState';

import { CSPR_TOKEN } from '../../../domain/constants/dex';
import type { IDexToken } from '../../../domain/swap';
import type { TokenPosition } from '../../../utils/swap';

export interface ISelectedTokensState {
  first: IDexToken | null;
  second: IDexToken | null;
}

export interface ITokenAmountsState {
  first: {
    formatted: string;
    raw: string;
  };
  second: {
    formatted: string;
    raw: string;
  };
}

interface IUseTokenPairStateParams {
  tokens?: IDexToken[];
  defaultTokenId?: string;
}

export const useTokenPairState = ({
  tokens,
  defaultTokenId = CSPR_TOKEN.id,
}: IUseTokenPairStateParams = {}) => {
  const tokenSelectorModal = useModalState(false);
  const reviewModal = useModalState(false);

  const [selectedTokens, setSelectedTokens] = useState<ISelectedTokensState>({
    first: null,
    second: null,
  });

  const [tokenAmounts, setTokenAmounts] = useState<ITokenAmountsState>({
    first: { formatted: '0', raw: '0' },
    second: { formatted: '0', raw: '0' },
  });

  const [activeTokenPosition, setActiveTokenPosition] = useState<TokenPosition>('first');
  const hasBothTokens = Boolean(selectedTokens.first && selectedTokens.second);

  const hasSetDefaultTokenRef = useRef(false);

  const debouncedTokenAmounts = useDebounce(tokenAmounts, 300);

  const customTokenHashes = useMemo(() => {
    const listedHashes = new Set((tokens ?? []).map(t => t.packageHash));

    return [selectedTokens.first, selectedTokens.second]
      .filter((t): t is IDexToken => !!t && !listedHashes.has(t.packageHash))
      .map(t => t.packageHash);
  }, [tokens, selectedTokens.first, selectedTokens.second]);

  const tokensWithAmounts = useMemo(() => {
    return {
      first: selectedTokens.first
        ? {
            ...selectedTokens.first,
            amountFormatted: debouncedTokenAmounts.first.formatted,
            amountRaw: debouncedTokenAmounts.first.raw,
          }
        : null,
      second: selectedTokens.second
        ? {
            ...selectedTokens.second,
            amountFormatted: debouncedTokenAmounts.second.formatted,
            amountRaw: debouncedTokenAmounts.second.raw,
          }
        : null,
    };
  }, [selectedTokens, debouncedTokenAmounts]);

  // Default to CSPR once, and only while nothing is selected — otherwise this would overwrite
  // tokens set through `setInitialTokens` (e.g. deep-link preselection).
  useEffect(() => {
    if (
      tokens &&
      !hasSetDefaultTokenRef.current &&
      !selectedTokens.first &&
      !selectedTokens.second
    ) {
      const defaultToken = tokens.find(token => token.id === defaultTokenId);

      if (defaultToken) {
        setSelectedTokens({
          first: defaultToken,
          second: null,
        });
        hasSetDefaultTokenRef.current = true;
      }
    }
  }, [tokens, selectedTokens.first, selectedTokens.second, defaultTokenId]);

  const resetTokenAmounts = useCallback(() => {
    setTokenAmounts({
      first: { formatted: '0', raw: '0' },
      second: { formatted: '0', raw: '0' },
    });
  }, []);

  const setInitialTokens = useCallback(
    (firstToken: IDexToken, secondToken: IDexToken | null) => {
      setSelectedTokens({
        first: firstToken,
        second: secondToken,
      });
      resetTokenAmounts();
    },
    [resetTokenAmounts],
  );

  const resetToDefaultTokens = useCallback(() => {
    const defaultToken = tokens?.find(token => token.id === defaultTokenId) ?? null;

    setSelectedTokens({
      first: defaultToken,
      second: null,
    });
    resetTokenAmounts();
  }, [tokens, defaultTokenId, resetTokenAmounts]);

  return {
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
    resetTokenAmounts,
    resetToDefaultTokens,

    tokenSelectorModal,
    reviewModal,
  };
};
