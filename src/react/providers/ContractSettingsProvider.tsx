import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';

import type { IContractSettings, IKeyValueStorage } from '../types';

import {
  DEADLINE_STORAGE_KEY,
  DEFAULT_DEADLINE,
  DEFAULT_SLIPPAGE,
  SLIPPAGE_STORAGE_KEY,
} from '../../domain/constants/dex';
import { clampDeadlineValue, clampSlippageValue } from '../../utils/swap';

export const ContractSettingsContext = createContext<IContractSettings | null>(null);

export const ContractSettingsProvider: React.FC<
  React.PropsWithChildren<{ storage?: IKeyValueStorage }>
> = ({ children, storage }) => {
  const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE);
  const [deadline, setDeadline] = useState(DEFAULT_DEADLINE);

  // Defaults hold until storage (if any) resolves; consumers without a storage adapter
  // keep in-memory-only settings.
  useEffect(() => {
    if (!storage) {
      return;
    }

    let cancelled = false;

    const hydrate = async () => {
      const [storedSlippage, storedDeadline] = await Promise.all([
        storage.get(SLIPPAGE_STORAGE_KEY),
        storage.get(DEADLINE_STORAGE_KEY),
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
  }, [storage]);

  const updateSlippage = useCallback(
    (value: number) => {
      const clamped = clampSlippageValue(value);
      setSlippage(clamped);
      storage?.set(SLIPPAGE_STORAGE_KEY, String(clamped));
    },
    [storage],
  );

  const updateDeadline = useCallback(
    (value: number) => {
      const clamped = clampDeadlineValue(value);
      setDeadline(clamped);
      storage?.set(DEADLINE_STORAGE_KEY, String(clamped));
    },
    [storage],
  );

  const value = useMemo<IContractSettings>(
    () => ({ slippage, deadline, updateSlippage, updateDeadline }),
    [slippage, deadline, updateSlippage, updateDeadline],
  );

  return (
    <ContractSettingsContext.Provider value={value}>{children}</ContractSettingsContext.Provider>
  );
};
