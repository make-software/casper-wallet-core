import { useCallback } from 'react';

import type { IDexTokenWithAmount, SwapQuoteType } from '../../../domain/swap';
import type { ISwapDependencies, ITransactionCallbacks } from '../../types';

export interface IUseSwapTransactionParams {
  firstToken: IDexTokenWithAmount;
  secondToken: IDexTokenWithAmount;
  publicKey: string;
  path: string[];
  quoteType: SwapQuoteType;
}

export interface IUseSwapTransactionDeps extends Pick<
  ISwapDependencies,
  'network' | 'dexContractRepository' | 'signer'
> {
  /** Max slippage in percent. Clamp with `clampSlippageValue` before passing it in. */
  slippage: number;
  /** Transaction deadline in minutes. Clamp with `clampDeadlineValue` before passing it in. */
  deadline: number;
}

/**
 * Builds a swap transaction — TransactionV1 only when the signer reports support for it — and
 * hands it to `signer.send`.
 */
export const useSwapTransaction = ({
  network,
  dexContractRepository,
  signer,
  slippage,
  deadline,
}: IUseSwapTransactionDeps) => {
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
