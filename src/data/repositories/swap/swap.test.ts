import { SwapRepository } from './index';
import { createMockHttpProvider } from '../../../__test-utils__';
import {
  HttpClientError,
  IDexContractPackage,
  SwapError,
  SwapQuoteType,
  TradeApiUrl,
  WrappedCsprContractPackageHash,
} from '../../../domain';
import type { DexTokenApiResponse, RawSwapQuote } from './types';

const WCSPR_HASH = WrappedCsprContractPackageHash.mainnet;

const makeContractPackage = (
  overrides: Partial<IDexContractPackage> = {},
): IDexContractPackage => ({
  contract_package_hash: 'cph_' + 'a'.repeat(60),
  owner_public_key: 'pk_' + 'a'.repeat(60),
  owner_hash: 'oh_' + 'a'.repeat(60),
  name: 'Sample Token',
  description: null,
  metadata: {
    balances_uref: '',
    decimals: 9,
    name: 'Sample Token',
    symbol: 'STK',
    total_supply_uref: '',
  },
  latest_version_contract_type_id: 2,
  timestamp: '2024-01-01T00:00:00.000Z',
  icon_url: 'https://example.com/icon.png',
  website_url: null,
  coingecko_id: null,
  latest_version_contract_hash: null,
  account_info: null,
  centralized_account_info: null,
  coingecko_data: null,
  friendlymarket_data: null,
  csprtrade_data: null,
  token_market_data: [
    {
      currency_id: 1,
      dex_id: 1,
      latest_rate: 0.5,
      timestamp: '2024-01-01T00:00:00.000Z',
      token_contract_package_hash: 'cph_' + 'a'.repeat(60),
      token_volume_24h: '1000',
      volume_24h: '1000',
    },
  ],
  ...overrides,
});

const makeDexTokenApiResponse = (
  overrides: Partial<DexTokenApiResponse> = {},
): DexTokenApiResponse => ({
  contract_package_hash: 'cph_' + 'a'.repeat(60),
  contract_package: makeContractPackage(),
  is_blacklisted: false,
  is_whitelisted: true,
  sorting_order: 1,
  total_value_locked: '5000',
  ...overrides,
});

const makeRawSwapQuote = (overrides: Partial<RawSwapQuote> = {}): RawSwapQuote => ({
  amount_in: '2000000000',
  amount_out: '1000000000',
  execution_price: '0.5',
  mid_price: '0.5',
  path: ['token-in-hash', 'token-out-hash'],
  price_impact: '0.01',
  recommended_slippage_bps: '50',
  type_id: SwapQuoteType.ExactIn,
  ...overrides,
});

describe('SwapRepository', () => {
  describe('getQuote', () => {
    it('sends the quote request with package hashes, amount, and type_id', async () => {
      const http = createMockHttpProvider();
      http.get.mockResolvedValueOnce({ data: makeRawSwapQuote() });
      const repo = new SwapRepository(http, TradeApiUrl, WrappedCsprContractPackageHash);

      const tokenIn = { id: 'token-in-id', packageHash: 'token-in-hash', decimals: 9 } as never;
      const tokenOut = {
        id: 'token-out-id',
        packageHash: 'token-out-hash',
        decimals: 9,
      } as never;

      await repo.getQuote({
        network: 'mainnet',
        tokenIn,
        tokenOut,
        amount: '2000000000',
        typeId: SwapQuoteType.ExactIn,
      });

      expect(http.get).toHaveBeenCalledTimes(1);
      const arg = http.get.mock.calls[0][0];
      expect(arg.url).toBe('https://api.cspr.trade/quote');
      expect(arg.params).toEqual({
        token_in: 'token-in-hash',
        token_out: 'token-out-hash',
        amount: '2000000000',
        type_id: SwapQuoteType.ExactIn,
      });
    });

    it('sends ZERO_HASH for the CSPR leg of the quote', async () => {
      const http = createMockHttpProvider();
      http.get.mockResolvedValueOnce({ data: makeRawSwapQuote() });
      const repo = new SwapRepository(http, TradeApiUrl, WrappedCsprContractPackageHash);

      const csprToken = { id: 'cspr', packageHash: WCSPR_HASH, decimals: 9 } as never;
      const tokenOut = {
        id: 'token-out-id',
        packageHash: 'token-out-hash',
        decimals: 9,
      } as never;

      await repo.getQuote({
        network: 'mainnet',
        tokenIn: csprToken,
        tokenOut,
        amount: '2000000000',
        typeId: SwapQuoteType.ExactIn,
      });

      const arg = http.get.mock.calls[0][0];
      expect(arg.params?.token_in).toBe(
        '0000000000000000000000000000000000000000000000000000000000000000',
      );
    });

    it('derives amountInDecimal, amountOutDecimal, and rate from the raw quote', async () => {
      const http = createMockHttpProvider();
      http.get.mockResolvedValueOnce({
        data: makeRawSwapQuote({ amount_in: '2000000000', amount_out: '1000000000' }),
      });
      const repo = new SwapRepository(http, TradeApiUrl, WrappedCsprContractPackageHash);

      const tokenIn = { id: 'token-in-id', packageHash: 'token-in-hash', decimals: 9 } as never;
      const tokenOut = {
        id: 'token-out-id',
        packageHash: 'token-out-hash',
        decimals: 9,
      } as never;

      const quote = await repo.getQuote({
        network: 'mainnet',
        tokenIn,
        tokenOut,
        amount: '2000000000',
        typeId: SwapQuoteType.ExactIn,
      });

      expect(quote.amountInDecimal).toBe('2');
      expect(quote.amountOutDecimal).toBe('1');
      expect(quote.rate).toBe('0.50');
    });
  });

  describe('getDexTokens', () => {
    it('filters by whitelist/blacklist and requests token_market_data + total_value_locked', async () => {
      const http = createMockHttpProvider();
      http.get.mockResolvedValueOnce({ data: [makeDexTokenApiResponse()] });
      const repo = new SwapRepository(http, TradeApiUrl, WrappedCsprContractPackageHash);

      await repo.getDexTokens({ network: 'mainnet', currencyId: 1 });

      const arg = http.get.mock.calls[0][0];
      expect(arg.url).toBe(
        'https://api.cspr.trade/tokens?includes=token_market_data(1),total_value_locked',
      );
      expect(arg.params).toEqual({ is_whitelisted: true, is_blacklisted: false });
    });

    it('maps the WCSPR record to the synthetic native CSPR token', async () => {
      const http = createMockHttpProvider();
      http.get.mockResolvedValueOnce({
        data: [
          makeDexTokenApiResponse({
            contract_package_hash: WCSPR_HASH,
            contract_package: makeContractPackage({ contract_package_hash: WCSPR_HASH }),
          }),
        ],
      });
      const repo = new SwapRepository(http, TradeApiUrl, WrappedCsprContractPackageHash);

      const [token] = await repo.getDexTokens({ network: 'mainnet', currencyId: 1 });

      expect(token).toMatchObject({
        id: 'cspr',
        name: 'Casper',
        symbol: 'CSPR',
        packageHash: WCSPR_HASH,
      });
    });

    it('maps an ordinary token by its own contract_package_hash and metadata', async () => {
      const http = createMockHttpProvider();
      const cph = 'cph_' + 'b'.repeat(60);
      http.get.mockResolvedValueOnce({
        data: [
          makeDexTokenApiResponse({
            contract_package_hash: cph,
            contract_package: makeContractPackage({
              contract_package_hash: cph,
              metadata: {
                balances_uref: '',
                decimals: 6,
                name: 'Other Token',
                symbol: 'OTK',
                total_supply_uref: '',
              },
            }),
          }),
        ],
      });
      const repo = new SwapRepository(http, TradeApiUrl, WrappedCsprContractPackageHash);

      const [token] = await repo.getDexTokens({ network: 'mainnet', currencyId: 1 });

      expect(token).toMatchObject({
        id: cph,
        name: 'Other Token',
        symbol: 'OTK',
        decimals: 6,
        packageHash: cph,
      });
    });
  });

  describe('getDexToken', () => {
    it('fetches a single token by hash with the same DTO mapping', async () => {
      const http = createMockHttpProvider();
      const cph = 'cph_' + 'c'.repeat(60);
      http.get.mockResolvedValueOnce({
        data: makeDexTokenApiResponse({
          contract_package_hash: cph,
          contract_package: makeContractPackage({ contract_package_hash: cph }),
        }),
      });
      const repo = new SwapRepository(http, TradeApiUrl, WrappedCsprContractPackageHash);

      const token = await repo.getDexToken({
        network: 'mainnet',
        contractPackageHash: cph,
        currencyId: 1,
      });

      const arg = http.get.mock.calls[0][0];
      expect(arg.url).toBe(
        `https://api.cspr.trade/tokens/${cph}?includes=token_market_data(1),total_value_locked`,
      );
      expect(token.id).toBe(cph);
    });
  });

  describe('getAccountTokenOwnership', () => {
    it('requests ownership and forwards contract package hashes as given', async () => {
      const http = createMockHttpProvider();
      http.get.mockResolvedValueOnce({ data: [] });
      const repo = new SwapRepository(http, TradeApiUrl, WrappedCsprContractPackageHash);

      await repo.getAccountTokenOwnership({
        network: 'mainnet',
        publicKey: 'pub-key',
        contractPackageHashes: ['hash-1', 'hash-2'],
      });

      const arg = http.get.mock.calls[0][0];
      expect(arg.url).toBe('https://api.cspr.trade/accounts/pub-key/ft-token-ownership');
      expect(arg.params?.contract_package_hash).toBe('hash-1,hash-2');
    });
  });

  describe('getCsprFiatRate', () => {
    it('resolves to the numeric rate', async () => {
      const http = createMockHttpProvider();
      http.get.mockResolvedValueOnce({
        data: { amount: 0.07, created: '2024-01-01T00:00:00.000Z', currency_id: 1 },
      });
      const repo = new SwapRepository(http, TradeApiUrl, WrappedCsprContractPackageHash);

      const rate = await repo.getCsprFiatRate({ network: 'mainnet', currencyId: 1 });

      expect(rate).toBe(0.07);
      const arg = http.get.mock.calls[0][0];
      expect(arg.url).toBe('https://api.cspr.trade/rates/1/latest');
    });

    it('throws a SwapError typed getCsprFiatRate when the amount is missing/non-numeric', async () => {
      const http = createMockHttpProvider();
      http.get.mockResolvedValueOnce({ data: { amount: 'nope' } });
      const repo = new SwapRepository(http, TradeApiUrl, WrappedCsprContractPackageHash);

      await expect(
        repo.getCsprFiatRate({ network: 'mainnet', currencyId: 1 }),
      ).rejects.toBeInstanceOf(SwapError);
      await expect(
        repo.getCsprFiatRate({ network: 'mainnet', currencyId: 1 }),
      ).rejects.toMatchObject({ type: 'getCsprFiatRate' });
    });
  });

  describe('getTokenFiatRate', () => {
    it('resolves to the numeric token fiat rate', async () => {
      const http = createMockHttpProvider();
      http.get.mockResolvedValueOnce({
        data: {
          amount: '0.5',
          currency_id: 1,
          dex_id: 1,
          timestamp: '2024-01-01T00:00:00.000Z',
          token_contract_package_hash: 'cph',
          transaction_hash: 'tx',
        },
      });
      const repo = new SwapRepository(http, TradeApiUrl, WrappedCsprContractPackageHash);

      const rate = await repo.getTokenFiatRate({
        network: 'mainnet',
        contractPackageHash: 'cph',
        currencyId: 1,
      });

      expect(rate).toBe(0.5);
      const arg = http.get.mock.calls[0][0];
      expect(arg.url).toBe('https://api.cspr.trade/ft/cph/rates/latest');
    });

    it('resolves to null when the API has no rate', async () => {
      const http = createMockHttpProvider();
      http.get.mockResolvedValueOnce({ data: undefined });
      const repo = new SwapRepository(http, TradeApiUrl, WrappedCsprContractPackageHash);

      const rate = await repo.getTokenFiatRate({
        network: 'mainnet',
        contractPackageHash: 'cph',
        currencyId: 1,
      });

      expect(rate).toBeNull();
    });
  });

  describe('getSwapsHistory', () => {
    it('requests /swaps with order/pagination params and returns paginated entries', async () => {
      const http = createMockHttpProvider();
      http.get.mockResolvedValueOnce({
        data: [],
        item_count: 0,
        page_count: 0,
        pages: [],
      });
      const repo = new SwapRepository(http, TradeApiUrl, WrappedCsprContractPackageHash);

      const result = await repo.getSwapsHistory({
        network: 'mainnet',
        pagination: { page: 2, pageSize: 25 },
        orderBy: 'timestamp',
        orderDirection: 'ASC',
        currencyId: 1,
      });

      const arg = http.get.mock.calls[0][0];
      expect(arg.url).toBe('https://api.cspr.trade/swaps');
      expect(arg.params).toMatchObject({
        page: 2,
        page_size: 25,
        order_by: 'timestamp',
        order_direction: 'ASC',
      });
      expect(result).toEqual({ data: [], itemCount: 0, pageCount: 0, pages: [] });
    });
  });

  describe('error wrapping', () => {
    it('wraps a non-domain rejection in a SwapError typed after the failing method', async () => {
      const http = createMockHttpProvider();
      http.get.mockRejectedValueOnce(new Error('boom'));
      const repo = new SwapRepository(http, TradeApiUrl, WrappedCsprContractPackageHash);

      await expect(
        repo.getCsprFiatRate({ network: 'mainnet', currencyId: 1 }),
      ).rejects.toMatchObject({ type: 'getCsprFiatRate' });
    });

    it('carries the response envelope and status over from a wrapped HttpError', async () => {
      const http = createMockHttpProvider();
      http.get.mockRejectedValueOnce(
        new HttpClientError('Bad Request', {
          type: 'getQuote',
          status: 400,
          data: JSON.stringify({ status: 400, data: { error: { code: 'invalid_input' } } }),
        }),
      );
      const repo = new SwapRepository(http, TradeApiUrl, WrappedCsprContractPackageHash);

      await expect(
        repo.getCsprFiatRate({ network: 'mainnet', currencyId: 1 }),
      ).rejects.toMatchObject({
        type: 'getCsprFiatRate',
        status: 400,
        data: expect.stringContaining('invalid_input'),
      });
    });

    it('rethrows an inner SwapError as-is instead of wrapping it again', async () => {
      const http = createMockHttpProvider();
      const innerError = new SwapError(new Error('already a swap error'), 'getDexTokens');
      http.get.mockRejectedValueOnce(innerError);
      const repo = new SwapRepository(http, TradeApiUrl, WrappedCsprContractPackageHash);

      await expect(repo.getCsprFiatRate({ network: 'mainnet', currencyId: 1 })).rejects.toBe(
        innerError,
      );
    });
  });

  describe('network without a configured URL', () => {
    it('throws a SwapError instead of requesting against an empty base URL', async () => {
      const http = createMockHttpProvider();
      const repo = new SwapRepository(http, TradeApiUrl, WrappedCsprContractPackageHash);

      await expect(
        repo.getCsprFiatRate({ network: 'devnet', currencyId: 1 }),
      ).rejects.toBeInstanceOf(SwapError);
      expect(http.get).not.toHaveBeenCalled();
    });
  });
});
