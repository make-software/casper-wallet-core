import { useCallback } from 'react';

import type { WrapDirection } from '../../../domain/dex';
import type { ISwapDependencies, ITransactionCallbacks } from '../../types';

export interface IUseWrapTransactionParams {
  direction: WrapDirection;
  rawAmount: string;
  publicKey: string;
}

export interface IUseWrapTransactionDeps extends Pick<
  ISwapDependencies,
  'network' | 'dexContractRepository' | 'signer'
> {}

/**
 * Builds a wrap or unwrap transaction from the direction — TransactionV1 only when the signer
 * reports support for it — and hands it to `signer.send`.
 */
export const useWrapTransaction = ({
  network,
  dexContractRepository,
  signer,
}: IUseWrapTransactionDeps) => {
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
