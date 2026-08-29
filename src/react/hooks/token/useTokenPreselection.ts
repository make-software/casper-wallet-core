import { useEffect, useRef } from 'react';

import { useFetchToken } from '../api/useFetchToken';

import type { IDexToken } from '../../../domain/swap';

interface IUseTokenPreselectionParams {
  tokenInHash?: string; // deep-link token hashes; router/URL parsing is the consumer's job
  tokenOutHash?: string;
  tokens: IDexToken[];
  setInitialTokens: (tokens: { first: IDexToken | null; second: IDexToken | null }) => void;
  setSelectedTokens: React.Dispatch<
    React.SetStateAction<{ first: IDexToken | null; second: IDexToken | null }>
  >;
}

export const useTokenPreselection = ({
  tokenInHash = '',
  tokenOutHash = '',
  tokens,
  setInitialTokens,
  setSelectedTokens,
}: IUseTokenPreselectionParams): void => {
  const hasSetRef = useRef(false);

  // `null` while the listed set is loading; only an explicit `false` triggers a custom fetch.
  const tokenInInListed = tokens ? tokens.some(t => t.packageHash === tokenInHash) : null;
  const tokenOutInListed = tokens ? tokens.some(t => t.packageHash === tokenOutHash) : null;

  const { token: customTokenIn } = useFetchToken(
    tokenInHash && tokenInInListed === false ? tokenInHash : '',
  );
  const { token: customTokenOut } = useFetchToken(
    tokenOutHash && tokenOutInListed === false ? tokenOutHash : '',
  );

  useEffect(() => {
    if (hasSetRef.current || !tokens) return;

    const tokenIn = tokens.find(t => t.packageHash === tokenInHash) ?? customTokenIn ?? null;
    const tokenOut = tokenOutHash
      ? (tokens.find(t => t.packageHash === tokenOutHash) ?? customTokenOut ?? null)
      : null;

    if (!tokenInHash) return;
    if (!tokenIn) return; // still loading or not found — effect re-runs when customTokenIn resolves

    if (tokenOut && tokenIn.id !== tokenOut.id) {
      setInitialTokens({ first: tokenIn, second: tokenOut });
    } else if (!tokenOutHash) {
      setSelectedTokens({ first: tokenIn, second: null });
    } else if (tokenOutHash && !tokenOut) {
      return; // tokenOut still loading — effect re-runs when customTokenOut resolves
    }

    hasSetRef.current = true;
  }, [
    tokens,
    tokenInHash,
    tokenOutHash,
    customTokenIn,
    customTokenOut,
    setInitialTokens,
    setSelectedTokens,
  ]);
};
