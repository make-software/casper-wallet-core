import { useCallback, useRef, useState } from 'react';

import type { TransactionStatus } from '../../types';

// Shared status map for any multi-step transaction flow (swap, wrap/unwrap). Manages only
// the per-operation TransactionStatus; approval-requirement flags stay flow-specific.
export const useTransactionStatuses = <Key extends string>(keys: readonly Key[]) => {
  // The operation set is fixed for a given flow, so capture it once to keep update/reset stable.
  const keysRef = useRef(keys);

  const buildIdleStates = useCallback(
    () =>
      keysRef.current.reduce(
        (states, key) => {
          states[key] = 'idle';

          return states;
        },
        {} as Record<Key, TransactionStatus>,
      ),
    [],
  );

  const [transactionStates, setTransactionStates] =
    useState<Record<Key, TransactionStatus>>(buildIdleStates);

  const updateTransactionState = useCallback((key: Key, status: TransactionStatus) => {
    setTransactionStates(prev => ({ ...prev, [key]: status }));
  }, []);

  const resetStates = useCallback(() => setTransactionStates(buildIdleStates()), [buildIdleStates]);

  return { transactionStates, updateTransactionState, resetStates };
};
