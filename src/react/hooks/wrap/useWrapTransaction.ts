import { useCallback } from 'react';

import { useRepositories } from '../context/useRepositories';
import { useSigner } from '../context/useSigner';

import type { WrapDirection } from '../../../domain/dex';
import type { ITransactionCallbacks } from '../../types';

export interface IUseWrapTransactionParams {
  direction: WrapDirection;
  rawAmount: string;
  publicKey: string;
}

/**
 * Builds a wrap or unwrap transaction from the direction — TransactionV1 only when the signer
 * reports support for it — and hands it to `signer.send`.
 */
export const useWrapTransaction = () => {
  const { network, dexContractRepository } = useRepositories();
  const signer = useSigner();

  const execute = useCallback(
    async (
      { direction, rawAmount, publicKey }: IUseWrapTransactionParams,
      callbacks: ITransactionCallbacks,
    ): Promise<void> => {
      if (!signer) {
        throw new Error('No signer configured');
      }

      const useTransactionV1 = signer.supportsTransactionV1;

      const built =
        direction === 'wrap'
          ? await dexContractRepository.buildWrapTransaction({
              network,
              publicKey,
              motesAmount: rawAmount,
              useTransactionV1,
            })
          : await dexContractRepository.buildUnwrapTransaction({
              network,
              publicKey,
              rawAmount,
              useTransactionV1,
            });

      return signer.send(built, callbacks);
    },
    [network, dexContractRepository, signer],
  );

  return { execute };
};
