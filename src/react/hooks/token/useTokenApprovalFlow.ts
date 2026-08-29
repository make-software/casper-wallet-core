import { useCallback } from 'react';

import { useRepositories } from '../context/useRepositories';

import type { ITransactionCallbacks } from '../../types';

interface IApprovalCheckConfig {
  contractPackageHash: string;
  requiredAmount: string;
}

interface IApprovalExecuteConfig {
  contractPackageHash: string;
  balance: string;
}

/**
 * Hook that handles checking approval requirements and executing approval transactions
 * for a single CEP-18 token/contract.
 */
export const useTokenApprovalFlow = () => {
  const { network, activePublicKey, dexContractRepository, signer } = useRepositories();

  const checkApprovalRequired = useCallback(
    async (config: IApprovalCheckConfig): Promise<boolean> => {
      if (!activePublicKey) {
        return false;
      }

      try {
        return await dexContractRepository.checkApprovalRequired({
          network,
          contractPackageHash: config.contractPackageHash,
          publicKey: activePublicKey,
          requiredAmount: config.requiredAmount,
        });
      } catch {
        return false;
      }
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
        amount: config.balance,
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
