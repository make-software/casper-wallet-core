/**
 * @jest-environment jsdom
 */
import { act, waitFor } from '@testing-library/react';

import { useSwapTokens } from './useSwapTokens';

import {
  renderHookWithQueryClient,
  stubDexContractRepository,
  stubSwapRepository,
  stubTokensRepository,
  TEST_PUBLIC_KEY,
} from '../../../__test-utils__/render-hook';
import type { IDexToken } from '../../../domain/swap';

const network = 'mainnet' as const;

const dexToken = (id: string, decimals: number): IDexToken =>
  ({ id, packageHash: `${id}-hash`, decimals, symbol: id.toUpperCase() }) as IDexToken;

const TOKEN_IN = dexToken('token-in', 9);
const TOKEN_OUT = dexToken('token-out', 6);

const makeDeps = (quote: unknown) => ({
  swapRepository: stubSwapRepository({
    getDexTokens: jest.fn().mockResolvedValue([TOKEN_IN, TOKEN_OUT]),
    getQuote: jest.fn().mockResolvedValue(quote),
  }),
  tokensRepository: stubTokensRepository({
    getCsprBalance: jest.fn().mockResolvedValue({ liquidBalance: '0' }),
    getTokens: jest.fn().mockResolvedValue([]),
  }),
  dexContractRepository: stubDexContractRepository({
    getLatestBlockTime: jest.fn().mockResolvedValue(Date.now()),
    checkApprovalRequired: jest.fn().mockResolvedValue(false),
  }),
});

const renderSwapTokens = (quote: unknown) => {
  const deps = makeDeps(quote);

  return renderHookWithQueryClient(() =>
    useSwapTokens({ network, activePublicKey: TEST_PUBLIC_KEY, slippage: 3, ...deps }),
  );
};

describe('useSwapTokens quotedTrade', () => {
  it('is null while no quote is in hand', async () => {
    const { result } = renderSwapTokens(null);

    await act(async () => undefined);

    expect(result.current.quotedTrade).toBeNull();
  });

  // The stubbed quote deliberately echoes an `amountInDecimal` the form never held: it is what
  // distinguishes "read off the quote" from "read off the form's own debounced amounts".
  it('reads both amounts and the route off the same quote, not off the form', async () => {
    const { result } = renderSwapTokens({
      path: [TOKEN_IN.packageHash, TOKEN_OUT.packageHash],
      amountInDecimal: '1.5',
      amountOutDecimal: '2.25',
      rate: '1.5',
      priceImpact: '0.1',
    });

    await act(async () => {
      result.current.setInitialTokens(TOKEN_IN, TOKEN_OUT);
    });

    await act(async () => {
      result.current.updateAmount('first', '9');
    });

    await waitFor(() => expect(result.current.quotedTrade).not.toBeNull(), { timeout: 3000 });

    expect(result.current.quotedTrade).toMatchObject({
      firstToken: { id: TOKEN_IN.id, amountFormatted: '1.5', amountRaw: '1500000000' },
      secondToken: { id: TOKEN_OUT.id, amountFormatted: '2.25', amountRaw: '2250000' },
      path: [TOKEN_IN.packageHash, TOKEN_OUT.packageHash],
    });
  });
});
