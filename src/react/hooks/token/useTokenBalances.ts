import { useCallback, useEffect, useMemo, useState } from 'react';

import { useFetchAccountTokenOwnership } from '../api/useFetchAccountTokenOwnership';
import { useFetchDexTokens } from '../api/useFetchDexTokens';
import { useRepositories } from '../context/useRepositories';

import { CSPR_DECIMALS, CSPR_NATIVE_TOKEN_ID } from '../../../domain/constants';
import { rawToFormattedSafe } from '../../../utils/amounts';

export interface ITokenBalances {
  formatted: Record<string, string>;
  raw: Record<string, string>;
}

interface IUseTokenBalancesParams {
  additionalContractPackageHashes?: string[];
}

interface IUseTokenBalancesReturn {
  tokenBalances: ITokenBalances;
  getFormattedBalance: (tokenId: string) => string;
  getRawBalance: (tokenId: string) => string;
  resetBalances: () => void;
  refetchCsprBalance: () => Promise<void>;
  refetchTokenBalances: () => Promise<void>;
}

export const useTokenBalances = ({
  additionalContractPackageHashes,
}: IUseTokenBalancesParams = {}): IUseTokenBalancesReturn => {
  const { network, activePublicKey, tokensRepository } = useRepositories();

  const [tokenBalances, setTokenBalances] = useState<ITokenBalances>({
    formatted: {},
    raw: {},
  });

  const { data: tokens } = useFetchDexTokens();

  const contractPackageHashes = useMemo(
    () => [
      ...(tokens ?? [])
        .filter(token => token.id !== CSPR_NATIVE_TOKEN_ID && token.packageHash)
        .map(token => token.packageHash),
      ...(additionalContractPackageHashes ?? []).filter(
        h => !(tokens ?? []).some(t => t.packageHash === h),
      ),
    ],
    [tokens, additionalContractPackageHashes],
  );

  const { data: ownershipData, refetch: refetchOwnership } = useFetchAccountTokenOwnership({
    contractPackageHashes,
    enabled: contractPackageHashes.length > 0,
  });

  const updateCSPRBalance = useCallback((rawBalance: string) => {
    setTokenBalances(prev => ({
      formatted: {
        ...prev.formatted,
        cspr: rawToFormattedSafe(rawBalance, CSPR_DECIMALS),
      },
      raw: {
        ...prev.raw,
        cspr: rawBalance,
      },
    }));
  }, []);

  // Pull-based: the library exposes only `activePublicKey`, not a live account object, so the
  // CSPR balance has to be fetched rather than pushed in from a wallet context.
  //
  // `liquidBalance`, not `totalBalance`: staked and undelegating motes cannot be spent, and
  // offering them as swappable would build transactions the chain rejects.
  const refetchCsprBalance = useCallback(async () => {
    if (!activePublicKey) {
      return;
    }

    const { liquidBalance } = await tokensRepository.getCsprBalance({
      network,
      publicKey: activePublicKey,
    });

    updateCSPRBalance(liquidBalance);
  }, [network, activePublicKey, tokensRepository, updateCSPRBalance]);

  useEffect(() => {
    setTokenBalances({
      formatted: {},
      raw: {},
    });

    if (!activePublicKey) {
      return;
    }

    refetchCsprBalance().catch(() => {
      // best-effort background refresh; callers can retry via the returned refetchCsprBalance
    });
  }, [activePublicKey, refetchCsprBalance]);

  useEffect(() => {
    if (!ownershipData?.length) {
      return;
    }

    const nextRaw: Record<string, string> = {};
    const nextFormatted: Record<string, string> = {};

    ownershipData.forEach(token => {
      const rawBalance = token.balance || '0';

      nextRaw[token.contractPackageHash] = rawBalance;
      nextFormatted[token.contractPackageHash] = rawToFormattedSafe(
        rawBalance,
        token.decimals,
        '0',
      );
    });

    setTokenBalances(prev => ({
      formatted: {
        ...prev.formatted,
        ...nextFormatted,
      },
      raw: {
        ...prev.raw,
        ...nextRaw,
      },
    }));
  }, [ownershipData]);

  const getFormattedBalance = useCallback(
    (tokenId: string): string => {
      const balance = tokenBalances.formatted[tokenId];

      if (balance === undefined) {
        return '0';
      }

      return balance;
    },
    [tokenBalances.formatted],
  );

  const getRawBalance = useCallback(
    (tokenId: string): string => {
      return tokenBalances.raw[tokenId] || '0';
    },
    [tokenBalances.raw],
  );

  const resetBalances = useCallback(() => {
    setTokenBalances({
      formatted: {},
      raw: {},
    });

    refetchCsprBalance().catch(() => {
      // best-effort background refresh; callers can retry via the returned refetchCsprBalance
    });
  }, [refetchCsprBalance]);

  const refetchTokenBalances = useCallback(async () => {
    await refetchOwnership();
  }, [refetchOwnership]);

  return {
    tokenBalances,
    getFormattedBalance,
    getRawBalance,
    resetBalances,
    refetchCsprBalance,
    refetchTokenBalances,
  };
};
