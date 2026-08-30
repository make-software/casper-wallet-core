/**
 * @jest-environment jsdom
 *
 * The four orchestrators are the public API the consuming apps render against. Nothing inside
 * this repository reads their return fields, so a rename type-checks clean and ships green —
 * and breaks both apps at runtime. These tests are the only thing that fails on it.
 */
import { act } from '@testing-library/react';
import { NEVER } from 'rxjs';

import { useReviewSwap } from './swap/useReviewSwap';
import { useSwapTokens } from './swap/useSwapTokens';
import { useReviewWrap } from './wrap/useReviewWrap';
import { useWrapTokens } from './wrap/useWrapTokens';

import {
  renderHookWithQueryClient,
  stubDexContractRepository,
  stubSwapRepository,
  stubTokensRepository,
  TEST_PUBLIC_KEY,
} from '../../__test-utils__/render-hook';
import type { ISwapFlowRunner, IWrapFlowRunner } from '../../domain/flows';
import { SwapQuoteType } from '../../domain/swap';
import type { IDexToken, IDexTokenWithAmount } from '../../domain/swap';

const network = 'mainnet' as const;

/** Never emits — this suite only asserts the hook's initial return shape. */
const swapFlowRunner: ISwapFlowRunner = {
  start: jest.fn(() => ({
    id: 'flow-1',
    events$: NEVER,
    done: new Promise(() => {}),
    cancel: jest.fn(),
  })),
  getActive: jest.fn(() => null),
};

/** Never emits — this suite only asserts the hook's initial return shape. */
const wrapFlowRunner: IWrapFlowRunner = {
  start: jest.fn(() => ({
    id: 'flow-2',
    events$: NEVER,
    done: new Promise(() => {}),
    cancel: jest.fn(),
  })),
  getActive: jest.fn(() => null),
};

const swapRepository = stubSwapRepository({
  getDexTokens: jest.fn().mockResolvedValue([]),
  getQuote: jest.fn().mockResolvedValue(null),
});
const tokensRepository = stubTokensRepository({
  getCsprBalance: jest.fn().mockResolvedValue({ liquidBalance: '0' }),
  getTokens: jest.fn().mockResolvedValue([]),
});
const dexContractRepository = stubDexContractRepository({
  getLatestBlockTime: jest.fn().mockResolvedValue(Date.now()),
  checkApprovalRequired: jest.fn().mockResolvedValue(false),
});

const token = (id: string): IDexTokenWithAmount =>
  ({
    id,
    packageHash: id,
    decimals: 9,
    symbol: id.toUpperCase(),
    amountFormatted: '1',
    amountRaw: '1000000000',
  }) as IDexTokenWithAmount;

const noop = () => {};

/** Lets the async balance reads settle, so their state updates land inside `act`. */
const flush = () => act(async () => undefined);

describe('orchestrator return shapes', () => {
  it('useSwapTokens', async () => {
    const { result } = renderHookWithQueryClient(() =>
      useSwapTokens({
        network,
        activePublicKey: TEST_PUBLIC_KEY,
        swapRepository,
        dexContractRepository,
        tokensRepository,
        slippage: 3,
      }),
    );

    await flush();

    expect(Object.keys(result.current).sort()).toEqual([
      'activeTokenPosition',
      'closeReviewModal',
      'closeTokenSelector',
      'firstTokenFiatAmount',
      'getMaxUsableBalance',
      'getRawTokenBalance',
      'getTokenBalance',
      'handleSwitchTokens',
      'hasTokensSelected',
      'isAmountEntered',
      'isAmountExceedsBalance',
      'isFormValid',
      'isInsufficientCsprForFees',
      'isReviewModalOpen',
      'isTokenSelectorOpen',
      'maxSlippage',
      'networkCost',
      'onSwapSuccess',
      'openReviewModal',
      'openTokenSelector',
      'path',
      'priceImpact',
      'protocolFee',
      'quote',
      'quoteData',
      'quoteType',
      'resetForm',
      'secondTokenFiatAmount',
      'selectToken',
      'selectedTokens',
      'setInitialTokens',
      'swapRoutes',
      'tokenAmounts',
      'tokens',
      'updateAmount',
    ]);
  });

  it('useWrapTokens', async () => {
    const { result } = renderHookWithQueryClient(() =>
      useWrapTokens({
        network,
        activePublicKey: TEST_PUBLIC_KEY,
        swapRepository,
        tokensRepository,
      }),
    );

    await flush();

    expect(Object.keys(result.current).sort()).toEqual([
      'amount',
      'closeReviewModal',
      'destinationToken',
      'direction',
      'getRawTokenBalance',
      'getTokenBalance',
      'isAmountEntered',
      'isAmountExceedsBalance',
      'isFormValid',
      'isInsufficientCsprForFees',
      'isReviewModalOpen',
      'onWrapSuccess',
      'openReviewModal',
      'resetAmount',
      'sourceRawAmount',
      'sourceToken',
      'sourceTokenFiatAmount',
      'switchDirection',
      'updateAmount',
    ]);
  });

  it('useReviewSwap', async () => {
    const { result } = renderHookWithQueryClient(() =>
      useReviewSwap({
        network,
        activePublicKey: TEST_PUBLIC_KEY,
        swapFlowRunner,
        slippage: 3,
        deadline: 20,
        firstToken: token('tokA'),
        secondToken: token('tokB'),
        path: ['tokA', 'tokB'],
        quoteType: SwapQuoteType.ExactIn,
        isOpen: true,
        onSwapSuccess: noop,
        onClose: noop,
      }),
    );

    await flush();

    expect(Object.keys(result.current).sort()).toEqual([
      'confirmSwap',
      'handleCloseSuccessModal',
      'isProcessing',
      'ledgerEvent',
      'resetForm',
      'step',
      'transactionHash',
      'transactionState',
    ]);
    expect(Object.keys(result.current.transactionState).sort()).toEqual(['approval', 'swap']);
  });

  it('useReviewWrap', async () => {
    const { result } = renderHookWithQueryClient(() =>
      useReviewWrap({
        network,
        activePublicKey: TEST_PUBLIC_KEY,
        wrapFlowRunner,
        direction: 'wrap',
        sourceToken: token('cspr') as unknown as IDexToken & IDexTokenWithAmount,
        isOpen: true,
        onWrapSuccess: noop,
        onClose: noop,
      }),
    );

    await flush();

    expect(Object.keys(result.current).sort()).toEqual([
      'confirmWrap',
      'error',
      'handleCloseSuccessModal',
      'isProcessing',
      'status',
      'step',
      'transactionHash',
    ]);
  });
});
