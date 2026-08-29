import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';

import type { IContractSettings, IContractSettingsStorageKeys, IKeyValueStorage } from '../types';

import { DEFAULT_DEADLINE, DEFAULT_SLIPPAGE } from '../../domain/constants';
import { clampDeadlineValue, clampSlippageValue } from '../../utils/swap';

export const ContractSettingsContext = createContext<IContractSettings | null>(null);

/** Persistence is all-or-nothing: an adapter is only usable together with the keys to store under. */
export type IContractSettingsProviderProps =
  | { storage?: undefined; storageKeys?: undefined }
  | { storage: IKeyValueStorage; storageKeys: IContractSettingsStorageKeys };

export const ContractSettingsProvider: React.FC<
  React.PropsWithChildren<IContractSettingsProviderProps>
> = ({ children, storage, storageKeys }) => {
  const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE);
  const [deadline, setDeadline] = useState(DEFAULT_DEADLINE);

  // Depend on the key strings rather than the object so an inline `storageKeys` literal does not
  // re-hydrate on every render.
  const slippageKey = storageKeys?.slippage;
  const deadlineKey = storageKeys?.deadline;

  // Defaults hold until storage (if any) resolves; consumers without a storage adapter
  // keep in-memory-only settings.
  useEffect(() => {
    if (!storage || slippageKey == null || deadlineKey == null) {
      return;
    }

    let cancelled = false;

    const hydrate = async () => {
      const [storedSlippage, storedDeadline] = await Promise.all([
        storage.get(slippageKey),
        storage.get(deadlineKey),
      ]);

      if (cancelled) {
        return;
      }

      if (storedSlippage != null) {
        setSlippage(clampSlippageValue(Number(storedSlippage)));
      }

      if (storedDeadline != null) {
        setDeadline(clampDeadlineValue(Number(storedDeadline)));
      }
    };

    hydrate();

    return () => {
      cancelled = true;
    };
  }, [storage, slippageKey, deadlineKey]);

  const updateSlippage = useCallback(
    (value: number) => {
      const clamped = clampSlippageValue(value);
      setSlippage(clamped);

      if (slippageKey != null) {
        storage?.set(slippageKey, String(clamped));
      }
    },
    [storage, slippageKey],
  );

  const updateDeadline = useCallback(
    (value: number) => {
      const clamped = clampDeadlineValue(value);
      setDeadline(clamped);

      if (deadlineKey != null) {
        storage?.set(deadlineKey, String(clamped));
      }
    },
    [storage, deadlineKey],
  );

  const value = useMemo<IContractSettings>(
    () => ({ slippage, deadline, updateSlippage, updateDeadline }),
    [slippage, deadline, updateSlippage, updateDeadline],
  );

  return (
    <ContractSettingsContext.Provider value={value}>{children}</ContractSettingsContext.Provider>
  );
};
