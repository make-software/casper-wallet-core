import { useCallback, useEffect, useMemo, useState } from 'react';

import { useFetchAccountTokenOwnership } from '../api/useFetchAccountTokenOwnership';
import { useFetchDexTokens } from '../api/useFetchDexTokens';
import { useRepositories } from '../context/useRepositories';

import { CSPR_TOKEN } from '../../../domain/constants/dex';
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
  const { network, activePublicKey, dexContractRepository } = useRepositories();

  const [tokenBalances, setTokenBalances] = useState<ITokenBalances>({
    formatted: {},
    raw: {},
  });

  const { data: tokens } = useFetchDexTokens();

  const contractPackageHashes = useMemo(
    () => [
      ...(tokens ?? [])
        .filter(token => token.id !== CSPR_TOKEN.id && token.packageHash)
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
        cspr: rawToFormattedSafe(rawBalance, CSPR_TOKEN.decimals),
      },
      raw: {
        ...prev.raw,
        cspr: rawBalance,
      },
    }));
  }, []);

  // Pull-based: the library exposes only `activePublicKey`, not a live account object, so the
  // CSPR balance has to be fetched rather than pushed in from a wallet context.
  const refetchCsprBalance = useCallback(async () => {
    if (!activePublicKey) {
      return;
    }

    const balance = await dexContractRepository.getCsprBalance({
      network,
      publicKey: activePublicKey,
    });

    updateCSPRBalance(balance);
  }, [network, activePublicKey, dexContractRepository, updateCSPRBalance]);

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

    ownershipData.forEach(item => {
      const decimals = item.contract_package?.metadata?.decimals;

      if (typeof decimals !== 'number') {
        return;
      }

      const rawBalance = item.balance || '0';
      const formattedBalance = rawToFormattedSafe(rawBalance, decimals, '0');

      nextRaw[item.contract_package_hash] = rawBalance;
      nextFormatted[item.contract_package_hash] = formattedBalance;
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
