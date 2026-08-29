import { useCallback, useState } from 'react';

import { useTransactionStatuses } from '../ui/useTransactionStatuses';

export interface IApprovalRequirements {
  firstRequired: boolean;
  isChecking: boolean;
}

const SWAP_STATUS_KEYS = ['approval', 'swap'] as const;

/** Swap-flow transaction statuses, plus the approval-requirement flags the review modal reads. */
export const useSwapStates = () => {
  const {
    transactionStates,
    updateTransactionState,
    resetStates: resetStatuses,
  } = useTransactionStatuses(SWAP_STATUS_KEYS);

  const [approvalRequirements, setApprovalRequirements] = useState<IApprovalRequirements>({
    firstRequired: false,
    isChecking: true,
  });

  const resetStates = useCallback(() => {
    resetStatuses();
    setApprovalRequirements({
      firstRequired: false,
      isChecking: true,
    });
  }, [resetStatuses]);

  return {
    transactionStates,
    approvalRequirements,
    setApprovalRequirements,
    updateTransactionState,
    resetStates,
  };
};
