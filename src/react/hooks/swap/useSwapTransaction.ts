import { useCallback } from 'react';

import { useContractSettings } from '../context/useContractSettings';
import { useRepositories } from '../context/useRepositories';
import { useSigner } from '../context/useSigner';

import type { IDexTokenWithAmount, SwapQuoteType } from '../../../domain/swap';
import type { ITransactionCallbacks } from '../../types';

export interface IUseSwapTransactionParams {
  firstToken: IDexTokenWithAmount;
  secondToken: IDexTokenWithAmount;
  publicKey: string;
  path: string[];
  quoteType: SwapQuoteType;
}

/**
 * Builds a swap transaction — slippage/deadline from `useContractSettings`, TransactionV1 only
 * when the signer reports support for it — and hands it to `signer.send`.
 */
export const useSwapTransaction = () => {
  const { network, dexContractRepository } = useRepositories();
  const { slippage, deadline } = useContractSettings();
  const signer = useSigner();

  const swapTokens = useCallback(
    async (params: IUseSwapTransactionParams, callbacks: ITransactionCallbacks): Promise<void> => {
      if (!signer) {
        throw new Error('No signer configured');
      }

      const built = await dexContractRepository.buildSwapTransaction({
        ...params,
        network,
        slippage,
        deadline,
        useTransactionV1: signer.supportsTransactionV1,
      });

      return signer.send(built, callbacks);
    },
    [network, dexContractRepository, slippage, deadline, signer],
  );

  return { swapTokens };
};
