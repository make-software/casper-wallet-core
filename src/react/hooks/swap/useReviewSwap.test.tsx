/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';

import { useReviewSwap } from './useReviewSwap';

import { stubDexContractRepository, TEST_PUBLIC_KEY } from '../../../__test-utils__/render-hook';
import type { IBuiltDexTransaction, IDexContractRepository } from '../../../domain/dex';
import { SwapQuoteType } from '../../../domain/swap';
import type { IDexTokenWithAmount } from '../../../domain/swap';
import type { ISigner, ITransactionCallbacks } from '../../types';

const BUILT = { kind: 'swap' } as IBuiltDexTransaction;

const token = (id: string): IDexTokenWithAmount =>
  ({
    id,
    packageHash: id,
    decimals: 9,
    amountRaw: '1000000000',
    amountFormatted: '1',
  }) as IDexTokenWithAmount;

/** A signer whose `send` drives the callbacks a real wallet provider would. */
const makeSigner = (
  behaviour: (callbacks: ITransactionCallbacks) => void = cb => cb.onProcessed?.(),
): ISigner => ({
  publicKey: TEST_PUBLIC_KEY,
  supportsTransactionV1: true,
  send: jest.fn(async (_built: IBuiltDexTransaction, callbacks: ITransactionCallbacks) => {
    behaviour(callbacks);
  }),
});

const setup = (over: Partial<IDexContractRepository> = {}, signer: ISigner = makeSigner()) => {
  const dexContractRepository = stubDexContractRepository({
    checkApprovalRequired: jest.fn().mockResolvedValue(true),
    buildApprovalTransaction: jest.fn().mockResolvedValue(BUILT),
    buildSwapTransaction: jest.fn().mockResolvedValue(BUILT),
    ...over,
  });

  const rendered = renderHook(() =>
    useReviewSwap({
      network: 'mainnet',
      activePublicKey: TEST_PUBLIC_KEY,
      dexContractRepository,
      signer,
      slippage: 3,
      deadline: 20,
      firstToken: token('tokA'),
      secondToken: token('tokB'),
      path: ['tokA', 'tokB'],
      quoteType: SwapQuoteType.ExactIn,
      isOpen: true,
      onSwapSuccess: jest.fn(),
      onClose: jest.fn(),
    }),
  );

  return { ...rendered, dexContractRepository };
};

describe('useReviewSwap', () => {
  describe('approval amount', () => {
    it('approves the required amount plus its buffer, not the balance', async () => {
      const buildApprovalTransaction = jest.fn().mockResolvedValue(BUILT);
      const { result } = setup({ buildApprovalTransaction });

      await act(async () => {
        await result.current.confirmSwap();
      });

      // requiredAmount = ceil(1000000000 * 1.03) = 1030000000; grant = floor(× 1.2).
      expect(buildApprovalTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ amount: '1236000000' }),
      );
    });

    it('grants at least what the check demands', async () => {
      const checkApprovalRequired = jest.fn().mockResolvedValue(true);
      const buildApprovalTransaction = jest.fn().mockResolvedValue(BUILT);
      const { result } = setup({ checkApprovalRequired, buildApprovalTransaction });

      await act(async () => {
        await result.current.confirmSwap();
      });

      const required = checkApprovalRequired.mock.calls[0][0].requiredAmount as string;
      const granted = buildApprovalTransaction.mock.calls[0][0].amount as string;

      expect(BigInt(granted)).toBeGreaterThan(BigInt(required));
    });
  });

  describe('failures', () => {
    it('surfaces the real reason rather than a generic string', async () => {
      const { result } = setup({
        buildSwapTransaction: jest.fn().mockRejectedValue(new Error('insufficient liquidity')),
      });

      await act(async () => {
        await result.current.confirmSwap();
      });

      expect(result.current.transactionState.swap.error).toBe('insufficient liquidity');
    });

    it('names a user cancellation as such', async () => {
      const signer = makeSigner(cb => cb.onCancelled?.());
      const { result } = setup(
        { checkApprovalRequired: jest.fn().mockResolvedValue(false) },
        signer,
      );

      await act(async () => {
        await result.current.confirmSwap();
      });

      expect(result.current.transactionState.swap.error).toBe('Swap transaction cancelled');
    });

    it('leaves the modal retryable instead of stuck processing', async () => {
      const { result } = setup({
        buildSwapTransaction: jest.fn().mockRejectedValue(new Error('rpc down')),
      });

      await act(async () => {
        await result.current.confirmSwap();
      });

      expect(result.current.step).toBe('confirm');
      expect(result.current.isProcessing).toBe(false);
    });

    it('scopes the error to the swap leg, leaving a completed approval reported as success', async () => {
      const { result } = setup({
        buildSwapTransaction: jest.fn().mockRejectedValue(new Error('rpc down')),
      });

      await act(async () => {
        await result.current.confirmSwap();
      });

      expect(result.current.transactionState.approval.status).toBe('success');
      expect(result.current.transactionState.approval.error).toBeUndefined();
      expect(result.current.transactionState.swap.error).toBe('rpc down');
    });

    it('scopes the error to the approval leg when the approval is what failed', async () => {
      const { result } = setup({
        buildApprovalTransaction: jest.fn().mockRejectedValue(new Error('approval build failed')),
      });

      await act(async () => {
        await result.current.confirmSwap();
      });

      expect(result.current.transactionState.approval.error).toBe('approval build failed');
      expect(result.current.transactionState.swap.error).toBeUndefined();
    });

    it('stops the flow when the approval check itself fails, rather than swapping unapproved', async () => {
      const buildSwapTransaction = jest.fn().mockResolvedValue(BUILT);
      const { result } = setup({
        checkApprovalRequired: jest.fn().mockRejectedValue(new Error('allowance unreadable')),
        buildSwapTransaction,
      });

      await act(async () => {
        await result.current.confirmSwap();
      });

      expect(buildSwapTransaction).not.toHaveBeenCalled();
      expect(result.current.transactionState.approval.error).toBe('allowance unreadable');
      // The "checking" spinner has to clear, or the modal hangs on it forever.
      await waitFor(() =>
        expect(result.current.transactionState.approval.status).not.toBe('pending'),
      );
    });
  });

  it('reaches the success step when both legs succeed', async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.confirmSwap();
    });

    expect(result.current.step).toBe('success');
    expect(result.current.transactionState.swap.status).toBe('success');
  });
});
