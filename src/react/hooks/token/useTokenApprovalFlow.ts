import { useCallback } from 'react';

import type { ISwapDependencies, ITransactionCallbacks } from '../../types';

interface IApprovalCheckConfig {
  contractPackageHash: string;
  requiredAmount: string;
}

interface IApprovalExecuteConfig {
  contractPackageHash: string;
  /** Raw amount to grant the trade contract. Must cover the check's `requiredAmount`. */
  approvalAmount: string;
}

export interface IUseTokenApprovalFlowParams extends Pick<
  ISwapDependencies,
  'network' | 'activePublicKey' | 'dexContractRepository' | 'signer'
> {}

/**
 * Hook that handles checking approval requirements and executing approval transactions
 * for a single CEP-18 token/contract.
 */
export const useTokenApprovalFlow = ({
  network,
  activePublicKey,
  dexContractRepository,
  signer,
}: IUseTokenApprovalFlowParams) => {
  // Rejections propagate: the repository already fails safe here (it returns `true` — "assume
  // approval is required" — when it cannot read the allowance), and a `false` default at this
  // layer would submit the swap with no allowance and revert on chain with the payment spent.
  const checkApprovalRequired = useCallback(
    async (config: IApprovalCheckConfig): Promise<boolean> => {
      if (!activePublicKey) {
        throw new Error('No active account');
      }

      return dexContractRepository.checkApprovalRequired({
        network,
        contractPackageHash: config.contractPackageHash,
        publicKey: activePublicKey,
        requiredAmount: config.requiredAmount,
      });
    },
    [network, activePublicKey, dexContractRepository],
  );

  const executeApproval = useCallback(
    async (config: IApprovalExecuteConfig, callbacks?: ITransactionCallbacks): Promise<void> => {
      if (!activePublicKey) {
        throw new Error('No active account');
      }

      if (!signer) {
        throw new Error('No signer configured');
      }

      const built = await dexContractRepository.buildApprovalTransaction({
        network,
        publicKey: activePublicKey,
        contractPackageHash: config.contractPackageHash,
        amount: config.approvalAmount,
        useTransactionV1: signer.supportsTransactionV1,
      });

      return new Promise((resolve, reject) => {
        const transactionCallbacks: ITransactionCallbacks = {
          onSent: hash => {
            callbacks?.onSent?.(hash);
          },
          onProcessed: () => {
            callbacks?.onProcessed?.();
            resolve();
          },
          onError: error => {
            callbacks?.onError?.(error);
            reject(error);
          },
          onCancelled: () => {
            callbacks?.onCancelled?.();
            reject(new Error('Approval cancelled'));
          },
        };

        signer.send(built, transactionCallbacks).catch(error => {
          reject(error);
        });
      });
    },
    [network, activePublicKey, signer, dexContractRepository],
  );

  const checkAndApprove = useCallback(
    async (
      checkConfig: IApprovalCheckConfig,
      executeConfig: IApprovalExecuteConfig,
      callbacks?: ITransactionCallbacks,
    ): Promise<void> => {
      const required = await checkApprovalRequired(checkConfig);

      if (required) {
        await executeApproval(executeConfig, callbacks);
      }
    },
    [checkApprovalRequired, executeApproval],
  );

  return {
    checkApprovalRequired,
    executeApproval,
    checkAndApprove,
  };
};
