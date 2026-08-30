/**
 * @jest-environment jsdom
 */
import { renderHook } from '@testing-library/react';

import { useSwapTransaction } from './useSwapTransaction';

import { stubDexContractRepository, TEST_PUBLIC_KEY } from '../../../__test-utils__/render-hook';
import { SwapQuoteType } from '../../../domain/swap';
import type { IDexTokenWithAmount } from '../../../domain/swap';
import type { IBuiltDexTransaction } from '../../../domain/dex';
import type { ISigner } from '../../types';

const SLIPPAGE = 3;
const DEADLINE = 20;

const BUILT = { kind: 'swap' } as IBuiltDexTransaction;

const token = (id: string): IDexTokenWithAmount =>
  ({
    id,
    packageHash: id,
    decimals: 9,
    amountRaw: '1000',
    amountFormatted: '1',
  }) as IDexTokenWithAmount;

const swapParams = {
  firstToken: token('tokA'),
  secondToken: token('tokB'),
  publicKey: TEST_PUBLIC_KEY,
  path: ['tokA', 'tokB'],
  quoteType: SwapQuoteType.ExactIn,
};

const makeSigner = (supportsTransactionV1 = true): ISigner => ({
  publicKey: TEST_PUBLIC_KEY,
  supportsTransactionV1,
  send: jest.fn().mockResolvedValue(undefined),
});

const setup = (signer: ISigner | null) => {
  const buildSwapTransaction = jest.fn().mockResolvedValue(BUILT);
  const { result } = renderHook(() =>
    useSwapTransaction({
      network: 'mainnet',
      dexContractRepository: stubDexContractRepository({ buildSwapTransaction }),
      signer,
      slippage: SLIPPAGE,
      deadline: DEADLINE,
    }),
  );

  return { buildSwapTransaction, swapTokens: result.current.swapTokens };
};

describe('useSwapTransaction', () => {
  // Transposing these two type-checks cleanly — both are plain numbers — and would silently
  // encode an `amount_out_min` 20% below the quoted output on every swap.
  it('passes slippage and deadline through in their own fields, not transposed', async () => {
    const { buildSwapTransaction, swapTokens } = setup(makeSigner());

    await swapTokens(swapParams, {});

    expect(buildSwapTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ slippage: SLIPPAGE, deadline: DEADLINE }),
    );
  });

  it('forwards the trade parameters and the network unchanged', async () => {
    const { buildSwapTransaction, swapTokens } = setup(makeSigner());

    await swapTokens(swapParams, {});

    expect(buildSwapTransaction).toHaveBeenCalledWith({
      ...swapParams,
      network: 'mainnet',
      slippage: SLIPPAGE,
      deadline: DEADLINE,
      useTransactionV1: true,
    });
  });

  it('asks for a legacy Deploy when the signer does not support TransactionV1', async () => {
    const { buildSwapTransaction, swapTokens } = setup(makeSigner(false));

    await swapTokens(swapParams, {});

    expect(buildSwapTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ useTransactionV1: false }),
    );
  });

  it('hands the built transaction to the signer with the callbacks it was given', async () => {
    const signer = makeSigner();
    const { swapTokens } = setup(signer);
    const callbacks = { onSent: jest.fn() };

    await swapTokens(swapParams, callbacks);

    expect(signer.send).toHaveBeenCalledWith(BUILT, callbacks);
  });

  it('rejects without building anything when no signer is configured', async () => {
    const { buildSwapTransaction, swapTokens } = setup(null);

    await expect(swapTokens(swapParams, {})).rejects.toThrow('No signer configured');
    expect(buildSwapTransaction).not.toHaveBeenCalled();
  });
});
