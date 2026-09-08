import { useEffect, useRef } from 'react';

import { useFetchToken } from '../api/useFetchToken';

import type { IDexToken } from '../../../domain/swap';
import type { ISwapDependencies } from '../../types';

export interface IUseTokenPreselectionParams extends Pick<
  ISwapDependencies,
  'network' | 'swapRepository'
> {
  tokenInHash?: string; // deep-link token hashes; router/URL parsing is the consumer's job
  tokenOutHash?: string;
  tokens: IDexToken[];
  setInitialTokens: (tokens: { first: IDexToken | null; second: IDexToken | null }) => void;
  setSelectedTokens: React.Dispatch<
    React.SetStateAction<{ first: IDexToken | null; second: IDexToken | null }>
  >;
}

export const useTokenPreselection = ({
  network,
  swapRepository,
  tokenInHash = '',
  tokenOutHash = '',
  tokens,
  setInitialTokens,
  setSelectedTokens,
}: IUseTokenPreselectionParams): void => {
  const hasSetRef = useRef(false);

  // `tokens` is a non-nullable array, so an empty list — still loading — is indistinguishable
  // from a loaded list that does not contain the hash, and both send it to the custom fetch.
  const tokenInInListed = tokens.some(t => t.packageHash === tokenInHash);
  const tokenOutInListed = tokens.some(t => t.packageHash === tokenOutHash);

  const { token: customTokenIn } = useFetchToken({
    network,
    swapRepository,
    contractPackageHash: tokenInHash && !tokenInInListed ? tokenInHash : '',
  });
  const { token: customTokenOut } = useFetchToken({
    network,
    swapRepository,
    contractPackageHash: tokenOutHash && !tokenOutInListed ? tokenOutHash : '',
  });

  useEffect(() => {
    if (hasSetRef.current) return;

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
    } else if (!tokenOut) {
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
