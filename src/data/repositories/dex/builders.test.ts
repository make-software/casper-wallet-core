import { Args, Deploy, RpcClient, Transaction } from 'casper-js-sdk';

import {
  createContractDeploy,
  createContractPackageCallTransaction,
  createSessionWasmTransaction,
  createWASMContractDeploy,
} from './transactionBuilders';
import * as transactionBuilders from './transactionBuilders';
import { DexContractRepository } from './index';
import {
  CasperSdkNetworkName,
  DEX_PAYMENT_AMOUNT,
  DEX_TRANSACTION_TTL_MS,
  DexError,
  IDexTokenWithAmount,
  MAX_DEADLINE,
  MAX_SLIPPAGE,
  SwapQuoteType,
  TradeContractPackageHash,
  WrappedCsprContractPackageHash,
} from '../../../domain';

const PUBLIC_KEY = '0106956df3aba7115e28271d053205ec7f33cab259f8e2da2f38150f0ece65a2a8';
const CONTRACT_PACKAGE_HASH = '04a11a367e708c52557930c4e9c1301f4465100d1b1b6d0a62b48d3e32402867';
const CHAIN_NAME = CasperSdkNetworkName.testnet;
const PAYMENT_MOTES = '5000000000';

const makeRpcClient = (apiVersion: string | Error): RpcClient =>
  ({
    getStatus:
      apiVersion instanceof Error
        ? jest.fn().mockRejectedValue(apiVersion)
        : jest.fn().mockResolvedValue({ apiVersion }),
  }) as unknown as RpcClient;

describe('transactionBuilders', () => {
  describe('createContractPackageCallTransaction', () => {
    it('returns a Transaction targeting the package hash, entry point, TTL and chain name', () => {
      const tx = createContractPackageCallTransaction({
        publicKey: PUBLIC_KEY,
        chainName: CHAIN_NAME,
        entryPoint: 'swap',
        paymentMotes: PAYMENT_MOTES,
        runtimeArgs: Args.fromMap({}),
        contractPackageHash: CONTRACT_PACKAGE_HASH,
        gasPriceTolerance: 1,
      });

      expect(tx).toBeInstanceOf(Transaction);
      expect(tx.chainName).toBe(CHAIN_NAME);
      expect(tx.ttl.toMilliseconds()).toBe(DEX_TRANSACTION_TTL_MS);
      expect(tx.entryPoint.customEntryPoint).toBe('swap');
      expect(tx.target.stored?.id.byPackageHash?.addr.toHex()).toBe(CONTRACT_PACKAGE_HASH);
    });

    it('exposes the payment amount', () => {
      const tx = createContractPackageCallTransaction({
        publicKey: PUBLIC_KEY,
        chainName: CHAIN_NAME,
        entryPoint: 'swap',
        paymentMotes: PAYMENT_MOTES,
        runtimeArgs: Args.fromMap({}),
        contractPackageHash: CONTRACT_PACKAGE_HASH,
        gasPriceTolerance: 1,
      });

      expect(tx.pricingMode.paymentLimited?.paymentAmount.toString()).toBe(PAYMENT_MOTES);
    });
  });

  describe('createContractDeploy', () => {
    it('returns a Deploy with the same targeting, TTL and chain name', () => {
      const deploy = createContractDeploy({
        publicKey: PUBLIC_KEY,
        chainName: CHAIN_NAME,
        paymentMotes: PAYMENT_MOTES,
        entryPoint: 'swap',
        runtimeArgs: Args.fromMap({}),
        contractPackageHash: CONTRACT_PACKAGE_HASH,
        gasPriceTolerance: 1,
      });

      expect(deploy).toBeInstanceOf(Deploy);
      expect(deploy.header.chainName).toBe(CHAIN_NAME);
      expect(deploy.header.ttl.toMilliseconds()).toBe(DEX_TRANSACTION_TTL_MS);
      expect(deploy.session.storedVersionedContractByHash?.entryPoint).toBe('swap');
      expect(deploy.session.storedVersionedContractByHash?.hash.hash.toHex()).toBe(
        CONTRACT_PACKAGE_HASH,
      );
    });

    it('exposes the payment amount', () => {
      const deploy = createContractDeploy({
        publicKey: PUBLIC_KEY,
        chainName: CHAIN_NAME,
        paymentMotes: PAYMENT_MOTES,
        entryPoint: 'swap',
        runtimeArgs: Args.fromMap({}),
        contractPackageHash: CONTRACT_PACKAGE_HASH,
        gasPriceTolerance: 1,
      });

      expect(deploy.payment.moduleBytes?.args.args.get('amount')?.toString()).toBe(PAYMENT_MOTES);
    });
  });

  describe('createSessionWasmTransaction', () => {
    const wasmBinary = new Uint8Array([1, 2, 3, 4]);

    it('returns a Transaction carrying the wasm session (Casper 2.x api)', async () => {
      const tx = await createSessionWasmTransaction({
        publicKey: PUBLIC_KEY,
        chainName: CHAIN_NAME,
        paymentMotes: PAYMENT_MOTES,
        wasmBinary,
        runtimeArgs: Args.fromMap({}),
        gasPriceTolerance: 1,
        rpcClient: makeRpcClient('2.0.0'),
      });

      expect(tx).toBeInstanceOf(Transaction);
      expect(tx.chainName).toBe(CHAIN_NAME);
      expect(tx.ttl.toMilliseconds()).toBe(DEX_TRANSACTION_TTL_MS);
      expect(tx.target.session?.moduleBytes).toEqual(wasmBinary);
      expect(tx.target.session?.isInstallUpgrade).toBe(true);
      expect(tx.pricingMode.paymentLimited?.paymentAmount.toString()).toBe(PAYMENT_MOTES);
    });

    it('returns a Transaction carrying the wasm session (legacy 1.x api)', async () => {
      const tx = await createSessionWasmTransaction({
        publicKey: PUBLIC_KEY,
        chainName: CHAIN_NAME,
        paymentMotes: PAYMENT_MOTES,
        wasmBinary,
        runtimeArgs: Args.fromMap({}),
        gasPriceTolerance: 1,
        rpcClient: makeRpcClient('1.5.6'),
      });

      expect(tx).toBeInstanceOf(Transaction);
      expect(tx.target.session?.moduleBytes).toEqual(wasmBinary);
    });

    it('rejects when the RPC getStatus call fails', async () => {
      await expect(
        createSessionWasmTransaction({
          publicKey: PUBLIC_KEY,
          chainName: CHAIN_NAME,
          paymentMotes: PAYMENT_MOTES,
          wasmBinary,
          runtimeArgs: Args.fromMap({}),
          gasPriceTolerance: 1,
          rpcClient: makeRpcClient(new Error('rpc down')),
        }),
      ).rejects.toThrow('rpc down');
    });
  });

  describe('createWASMContractDeploy', () => {
    const wasmBinary = new Uint8Array([1, 2, 3, 4]);

    it('returns a Deploy carrying the wasm, TTL and chain name', () => {
      const deploy = createWASMContractDeploy({
        publicKey: PUBLIC_KEY,
        chainName: CHAIN_NAME,
        paymentMotes: PAYMENT_MOTES,
        wasmBinary,
        runtimeArgs: Args.fromMap({}),
        gasPriceTolerance: 1,
      });

      expect(deploy).toBeInstanceOf(Deploy);
      expect(deploy.header.chainName).toBe(CHAIN_NAME);
      expect(deploy.header.ttl.toMilliseconds()).toBe(DEX_TRANSACTION_TTL_MS);
      expect(deploy.session.moduleBytes?.moduleBytes).toEqual(wasmBinary);
    });

    it('exposes the payment amount', () => {
      const deploy = createWASMContractDeploy({
        publicKey: PUBLIC_KEY,
        chainName: CHAIN_NAME,
        paymentMotes: PAYMENT_MOTES,
        wasmBinary,
        runtimeArgs: Args.fromMap({}),
        gasPriceTolerance: 1,
      });

      expect(deploy.payment.moduleBytes?.args.args.get('amount')?.toString()).toBe(PAYMENT_MOTES);
    });
  });
});

describe('DexContractRepository builders', () => {
  const NETWORK = 'testnet' as const;

  const GRPC_URL = {
    mainnet: 'https://rpc.mainnet.example.com',
    testnet: 'https://rpc.testnet.example.com',
    devnet: '',
    integration: '',
  };

  const WASM_BINARY = new Uint8Array([9, 8, 7, 6]);

  const makeDexConfig = (
    overrides: { getProxyWasm?: (() => Promise<Uint8Array>) | undefined } = {},
  ) => ({
    tradeContractPackageHash: TradeContractPackageHash,
    wrappedCsprContractPackageHash: WrappedCsprContractPackageHash,
    gasPriceTolerance: 1,
    getProxyWasm: jest.fn().mockResolvedValue(WASM_BINARY),
    ...overrides,
  });

  const makeToken = (overrides: Partial<IDexTokenWithAmount>): IDexTokenWithAmount => ({
    id: 'tokA',
    name: 'Token A',
    symbol: 'TOKA',
    icon: null,
    decimals: 9,
    packageHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    isWhitelisted: true,
    isBlacklisted: false,
    fiatRates: null,
    totalValueLocked: null,
    volume24h: null,
    amountFormatted: '0',
    amountRaw: '0',
    ...overrides,
  });

  // The token DTO maps the WCSPR record onto the synthetic `cspr` id while keeping the real
  // on-chain package hash, so the native fixture carries the WCSPR hash here too.
  const NATIVE = makeToken({
    id: 'cspr',
    symbol: 'CSPR',
    packageHash: WrappedCsprContractPackageHash[NETWORK],
  });
  const TOKEN_A = makeToken({
    id: 'tokA',
    packageHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  });
  const TOKEN_B = makeToken({
    id: 'tokB',
    packageHash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  });

  // Amounts are assigned by position (first/second), not by token identity, so a native token
  // can occupy either position and carries that position's amount.
  const FIRST_AMOUNT_RAW = '1000';
  const SECOND_AMOUNT_RAW = '2000';
  const asFirst = (token: IDexTokenWithAmount): IDexTokenWithAmount => ({
    ...token,
    amountRaw: FIRST_AMOUNT_RAW,
  });
  const asSecond = (token: IDexTokenWithAmount): IDexTokenWithAmount => ({
    ...token,
    amountRaw: SECOND_AMOUNT_RAW,
  });

  const SLIPPAGE = 3;
  const DEADLINE_MINUTES = 20;
  const AMOUNT_OUT_MIN = '1940'; // calculateMinAmountWithSlippage('2000', 3)
  const AMOUNT_IN_MAX = '1030'; // calculateMaxAmountWithSlippage('1000', 3)
  const BLOCK_TIME_MS = 1_700_000_000_000;

  /** A repository whose chain-time read is stubbed, so the built deadline is deterministic. */
  const makeRepo = (
    dexConfig: ReturnType<typeof makeDexConfig> = makeDexConfig(),
  ): DexContractRepository => {
    const repo = new DexContractRepository(GRPC_URL, dexConfig);
    jest.spyOn(repo, 'getLatestBlockTime').mockResolvedValue(BLOCK_TIME_MS);

    return repo;
  };

  /** Decodes the byte-array inner args carried inside the proxy envelope's `args` field. */
  const decodeInnerArgs = (outerRuntimeArgs: Args): Args => {
    const list = outerRuntimeArgs.args.get('args');
    const bytes = Uint8Array.from(
      (list?.list?.elements ?? []).map(el => Number(el.ui8!.toString())),
    );

    return Args.fromBytes(bytes);
  };

  const swapParams = ({
    path,
    ...overrides
  }: {
    firstToken: IDexTokenWithAmount;
    secondToken: IDexTokenWithAmount;
    quoteType: SwapQuoteType;
    useTransactionV1?: boolean;
    slippage?: number;
    deadline?: number;
    path?: string[];
  }) => ({
    network: NETWORK,
    publicKey: PUBLIC_KEY,
    slippage: SLIPPAGE,
    deadline: DEADLINE_MINUTES,
    useTransactionV1: true,
    // The route the builder accepts has to start at the input token and end at the output
    // token; each case therefore derives it from its own pair unless it overrides it.
    path: path ?? [overrides.firstToken.packageHash, overrides.secondToken.packageHash],
    ...overrides,
  });

  describe('buildSwapTransaction', () => {
    it.each([
      {
        name: 'CSPR→token ExactIn',
        params: swapParams({
          firstToken: asFirst(NATIVE),
          secondToken: asSecond(TOKEN_B),
          quoteType: SwapQuoteType.ExactIn,
        }),
        entryPoint: 'swap_exact_cspr_for_tokens',
        innerKeys: ['path', 'to', 'deadline', 'amount_out_min'],
        attachedValue: FIRST_AMOUNT_RAW,
        paymentMotes: DEX_PAYMENT_AMOUNT.swapCsprForToken,
      },
      {
        name: 'CSPR→token ExactOut',
        params: swapParams({
          firstToken: asFirst(NATIVE),
          secondToken: asSecond(TOKEN_B),
          quoteType: SwapQuoteType.ExactOut,
        }),
        entryPoint: 'swap_cspr_for_exact_tokens',
        innerKeys: ['path', 'to', 'deadline', 'amount_out'],
        attachedValue: AMOUNT_IN_MAX,
        paymentMotes: DEX_PAYMENT_AMOUNT.swapCsprForToken,
      },
      {
        name: 'token→CSPR ExactIn',
        params: swapParams({
          firstToken: asFirst(TOKEN_A),
          secondToken: asSecond(NATIVE),
          quoteType: SwapQuoteType.ExactIn,
        }),
        entryPoint: 'swap_exact_tokens_for_cspr',
        innerKeys: ['path', 'to', 'deadline', 'amount_in', 'amount_out_min'],
        attachedValue: '0',
        paymentMotes: DEX_PAYMENT_AMOUNT.swapCsprForToken,
      },
      {
        name: 'token→CSPR ExactOut',
        params: swapParams({
          firstToken: asFirst(TOKEN_A),
          secondToken: asSecond(NATIVE),
          quoteType: SwapQuoteType.ExactOut,
        }),
        entryPoint: 'swap_tokens_for_exact_cspr',
        innerKeys: ['path', 'to', 'deadline', 'amount_in_max', 'amount_out'],
        attachedValue: '0',
        paymentMotes: DEX_PAYMENT_AMOUNT.swapCsprForToken,
      },
      {
        name: 'token→token ExactIn',
        params: swapParams({
          firstToken: asFirst(TOKEN_A),
          secondToken: asSecond(TOKEN_B),
          quoteType: SwapQuoteType.ExactIn,
        }),
        entryPoint: 'swap_exact_tokens_for_tokens',
        innerKeys: ['path', 'to', 'deadline', 'amount_in', 'amount_out_min'],
        attachedValue: '0',
        paymentMotes: DEX_PAYMENT_AMOUNT.swapTokenForToken,
      },
      {
        name: 'token→token ExactOut',
        params: swapParams({
          firstToken: asFirst(TOKEN_A),
          secondToken: asSecond(TOKEN_B),
          quoteType: SwapQuoteType.ExactOut,
        }),
        entryPoint: 'swap_tokens_for_exact_tokens',
        innerKeys: ['path', 'to', 'deadline', 'amount_in_max', 'amount_out'],
        attachedValue: '0',
        paymentMotes: DEX_PAYMENT_AMOUNT.swapTokenForToken,
      },
    ])(
      '$name: entryPoint, inner args, proxy envelope and payment',
      async ({ params, entryPoint, innerKeys, attachedValue, paymentMotes }) => {
        const spy = jest
          .spyOn(transactionBuilders, 'createSessionWasmTransaction')
          .mockResolvedValue({ fake: 'transaction' } as unknown as Transaction);
        const repo = makeRepo();

        await repo.buildSwapTransaction(params);

        expect(spy).toHaveBeenCalledTimes(1);
        const call = spy.mock.calls[0][0];
        expect(call.wasmBinary).toBe(WASM_BINARY);
        expect(call.paymentMotes).toBe(paymentMotes);

        const outerArgs = call.runtimeArgs;
        expect(outerArgs.args.get('entry_point')?.stringVal?.toString()).toBe(entryPoint);
        expect(outerArgs.args.get('attached_value')?.ui512?.toString()).toBe(attachedValue);
        expect(outerArgs.args.get('amount')?.ui512?.toString()).toBe(attachedValue);

        const innerArgs = decodeInnerArgs(outerArgs);
        expect([...innerArgs.args.keys()].sort()).toEqual([...innerKeys].sort());

        if (innerArgs.args.has('amount_out_min')) {
          expect(innerArgs.args.get('amount_out_min')?.ui256?.toString()).toBe(AMOUNT_OUT_MIN);
        }
        if (innerArgs.args.has('amount_in_max')) {
          expect(innerArgs.args.get('amount_in_max')?.ui256?.toString()).toBe(AMOUNT_IN_MAX);
        }
        if (innerArgs.args.has('amount_in')) {
          expect(innerArgs.args.get('amount_in')?.ui256?.toString()).toBe('1000');
        }
        if (innerArgs.args.has('amount_out')) {
          expect(innerArgs.args.get('amount_out')?.ui256?.toString()).toBe('2000');
        }
      },
    );

    it('both tokens native: rejects with "Invalid swap entry point"', async () => {
      const repo = makeRepo();

      await expect(
        repo.buildSwapTransaction(
          swapParams({
            firstToken: asFirst(NATIVE),
            secondToken: asSecond(NATIVE),
            quoteType: SwapQuoteType.ExactIn,
          }),
        ),
      ).rejects.toMatchObject({
        name: 'DexRepositoryError',
        message: expect.stringContaining('Invalid swap entry point'),
      });
    });

    it('proxy envelope: outer args are exactly package_hash, entry_point, args, attached_value, amount', async () => {
      const spy = jest
        .spyOn(transactionBuilders, 'createSessionWasmTransaction')
        .mockResolvedValue({ fake: 'transaction' } as unknown as Transaction);
      const repo = makeRepo();

      await repo.buildSwapTransaction(
        swapParams({
          firstToken: asFirst(NATIVE),
          secondToken: asSecond(TOKEN_B),
          quoteType: SwapQuoteType.ExactIn,
        }),
      );

      const outerArgs = spy.mock.calls[0][0].runtimeArgs;
      expect([...outerArgs.args.keys()].sort()).toEqual(
        ['package_hash', 'entry_point', 'args', 'attached_value', 'amount'].sort(),
      );
      expect(outerArgs.args.get('package_hash')?.byteArray?.toString()).toBe(
        TradeContractPackageHash[NETWORK],
      );
    });

    it('supportsTransactionV1=true: returns a real Transaction (transaction set, deploy undefined), kind "swap"', async () => {
      const repo = makeRepo();
      jest.spyOn(repo as any, '_getClient').mockReturnValue({
        getStatus: jest.fn().mockResolvedValue({ apiVersion: '2.0.0' }),
      });

      const result = await repo.buildSwapTransaction(
        swapParams({
          firstToken: asFirst(NATIVE),
          secondToken: asSecond(TOKEN_B),
          quoteType: SwapQuoteType.ExactIn,
          useTransactionV1: true,
        }),
      );

      expect(result.kind).toBe('swap');
      expect(result.transaction).toBeInstanceOf(Transaction);
      expect(result.deploy).toBeUndefined();
    });

    it('supportsTransactionV1=false: returns a real Deploy (deploy set, transaction undefined), kind "swap"', async () => {
      const repo = makeRepo();

      const result = await repo.buildSwapTransaction(
        swapParams({
          firstToken: asFirst(NATIVE),
          secondToken: asSecond(TOKEN_B),
          quoteType: SwapQuoteType.ExactIn,
          useTransactionV1: false,
        }),
      );

      expect(result.kind).toBe('swap');
      expect(result.deploy).toBeInstanceOf(Deploy);
      expect(result.transaction).toBeUndefined();
    });

    describe('route endpoints', () => {
      const expectRejectedRoute = async (path: string[], expectedMessage: string) => {
        const repo = makeRepo();

        await expect(
          repo.buildSwapTransaction(
            swapParams({
              firstToken: asFirst(TOKEN_A),
              secondToken: asSecond(TOKEN_B),
              quoteType: SwapQuoteType.ExactIn,
              path,
            }),
          ),
        ).rejects.toMatchObject({
          name: 'DexRepositoryError',
          type: 'buildSwapTransaction',
          message: expect.stringContaining(expectedMessage),
        });
      };

      it('rejects a route whose terminal hop is not the selected output token', async () => {
        const attackerToken = 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';

        await expectRejectedRoute([TOKEN_A.packageHash, attackerToken], 'route ends at');
      });

      it('rejects a route whose first hop is not the selected input token', async () => {
        await expectRejectedRoute([TOKEN_B.packageHash, TOKEN_B.packageHash], 'route starts at');
      });

      it('rejects a route with fewer than two hops', async () => {
        await expectRejectedRoute([TOKEN_A.packageHash], 'at least 2 hops');
      });

      it('accepts a multi-hop route whose ends match the selected pair', async () => {
        const spy = jest
          .spyOn(transactionBuilders, 'createSessionWasmTransaction')
          .mockResolvedValue({ fake: 'transaction' } as unknown as Transaction);
        const repo = makeRepo();

        await repo.buildSwapTransaction(
          swapParams({
            firstToken: asFirst(TOKEN_A),
            secondToken: asSecond(TOKEN_B),
            quoteType: SwapQuoteType.ExactIn,
            path: [TOKEN_A.packageHash, NATIVE.packageHash, TOKEN_B.packageHash],
          }),
        );

        expect(spy).toHaveBeenCalledTimes(1);
      });

      it('matches endpoints case-insensitively', async () => {
        const spy = jest
          .spyOn(transactionBuilders, 'createSessionWasmTransaction')
          .mockResolvedValue({ fake: 'transaction' } as unknown as Transaction);
        const repo = makeRepo();

        await repo.buildSwapTransaction(
          swapParams({
            firstToken: asFirst(TOKEN_A),
            secondToken: asSecond(TOKEN_B),
            quoteType: SwapQuoteType.ExactIn,
            path: [TOKEN_A.packageHash.toUpperCase(), TOKEN_B.packageHash.toUpperCase()],
          }),
        );

        expect(spy).toHaveBeenCalledTimes(1);
      });

      it('resolves a native leg against the configured WCSPR hash', async () => {
        const repo = makeRepo();

        await expect(
          repo.buildSwapTransaction(
            swapParams({
              firstToken: asFirst(NATIVE),
              secondToken: asSecond(TOKEN_B),
              quoteType: SwapQuoteType.ExactIn,
              path: [TOKEN_A.packageHash, TOKEN_B.packageHash],
            }),
          ),
        ).rejects.toMatchObject({
          message: expect.stringContaining(WrappedCsprContractPackageHash[NETWORK]),
        });
      });
    });

    describe('slippage and deadline bounds', () => {
      const expectRejected = async (
        overrides: { slippage?: number; deadline?: number },
        expectedMessage: string,
      ) => {
        const repo = makeRepo();

        await expect(
          repo.buildSwapTransaction(
            swapParams({
              firstToken: asFirst(TOKEN_A),
              secondToken: asSecond(TOKEN_B),
              quoteType: SwapQuoteType.ExactIn,
              ...overrides,
            }),
          ),
        ).rejects.toMatchObject({
          name: 'DexRepositoryError',
          type: 'buildSwapTransaction',
          message: expect.stringContaining(expectedMessage),
        });
      };

      // 100 is what a basis-points/percent confusion on `recommendedSlippageBps` produces for a
      // backend-recommended 1%, and it would encode `amount_out_min: 0`.
      it.each([100, 100.5, -1, NaN, Infinity])('rejects slippage %p', async slippage => {
        await expectRejected({ slippage }, 'Invalid slippage');
      });

      it('rejects a slippage above MAX_SLIPPAGE', async () => {
        await expectRejected({ slippage: MAX_SLIPPAGE + 0.01 }, 'Invalid slippage');
      });

      it.each([0, -5, NaN, Infinity, MAX_DEADLINE + 1])('rejects deadline %p', async deadline => {
        await expectRejected({ deadline }, 'Invalid deadline');
      });
    });

    it('derives the deadline from chain time, not the device clock', async () => {
      const spy = jest
        .spyOn(transactionBuilders, 'createSessionWasmTransaction')
        .mockResolvedValue({ fake: 'transaction' } as unknown as Transaction);
      const repo = makeRepo();
      jest.spyOn(Date, 'now').mockReturnValue(BLOCK_TIME_MS + 60 * 60 * 1000);

      await repo.buildSwapTransaction(
        swapParams({
          firstToken: asFirst(TOKEN_A),
          secondToken: asSecond(TOKEN_B),
          quoteType: SwapQuoteType.ExactIn,
        }),
      );

      const innerArgs = decodeInnerArgs(spy.mock.calls[0][0].runtimeArgs);
      expect(innerArgs.args.get('deadline')?.ui64?.toString()).toBe(
        String(BLOCK_TIME_MS + DEADLINE_MINUTES * 60_000),
      );
    });

    it('rejects when the chain-time read fails, rather than falling back to the device clock', async () => {
      const repo = new DexContractRepository(GRPC_URL, makeDexConfig());
      jest
        .spyOn(repo, 'getLatestBlockTime')
        .mockRejectedValue(new DexError(new Error('rpc down'), 'getLatestBlockTime'));

      await expect(
        repo.buildSwapTransaction(
          swapParams({
            firstToken: asFirst(TOKEN_A),
            secondToken: asSecond(TOKEN_B),
            quoteType: SwapQuoteType.ExactIn,
          }),
        ),
      ).rejects.toMatchObject({ name: 'DexRepositoryError', message: 'rpc down' });
    });

    it('rejects a DexError typed "buildSwapTransaction" naming getProxyWasm when the config omits it', async () => {
      const repo = makeRepo(makeDexConfig({ getProxyWasm: undefined }));

      await expect(
        repo.buildSwapTransaction(
          swapParams({
            firstToken: asFirst(NATIVE),
            secondToken: asSecond(TOKEN_B),
            quoteType: SwapQuoteType.ExactIn,
          }),
        ),
      ).rejects.toMatchObject({
        name: 'DexRepositoryError',
        type: 'buildSwapTransaction',
        message: expect.stringContaining('getProxyWasm'),
      });
    });
  });

  describe('buildApprovalTransaction', () => {
    it('direct contract-package call: kind, entryPoint, args (spender + amount) and payment; no wasm fetched', async () => {
      const dexConfig = makeDexConfig();
      const spy = jest
        .spyOn(transactionBuilders, 'createContractPackageCallTransaction')
        .mockReturnValue({ fake: 'transaction' } as unknown as Transaction);
      const repo = new DexContractRepository(GRPC_URL, dexConfig);

      const result = await repo.buildApprovalTransaction({
        network: NETWORK,
        publicKey: PUBLIC_KEY,
        contractPackageHash: TOKEN_A.packageHash,
        amount: '500',
        useTransactionV1: true,
      });

      expect(result.kind).toBe('approve');
      expect(result.entryPoint).toBe('approve');
      expect(result.paymentMotes).toBe(DEX_PAYMENT_AMOUNT.approve);
      expect(dexConfig.getProxyWasm).not.toHaveBeenCalled();

      const call = spy.mock.calls[0][0];
      expect(call.contractPackageHash).toBe(TOKEN_A.packageHash);
      expect(call.entryPoint).toBe('approve');
      expect(call.runtimeArgs.args.get('spender')?.key?.toPrefixedString()).toBe(
        `hash-${TradeContractPackageHash[NETWORK]}`,
      );
      expect(call.runtimeArgs.args.get('amount')?.ui256?.toString()).toBe('500');
    });

    it('useTransactionV1=true: returns a real Transaction (transaction set, deploy undefined)', async () => {
      const repo = new DexContractRepository(GRPC_URL, makeDexConfig());

      const result = await repo.buildApprovalTransaction({
        network: NETWORK,
        publicKey: PUBLIC_KEY,
        contractPackageHash: TOKEN_A.packageHash,
        amount: '500',
        useTransactionV1: true,
      });

      expect(result.transaction).toBeInstanceOf(Transaction);
      expect(result.deploy).toBeUndefined();
    });

    it('useTransactionV1=false: returns a real Deploy (deploy set, transaction undefined)', async () => {
      const repo = new DexContractRepository(GRPC_URL, makeDexConfig());

      const result = await repo.buildApprovalTransaction({
        network: NETWORK,
        publicKey: PUBLIC_KEY,
        contractPackageHash: TOKEN_A.packageHash,
        amount: '500',
        useTransactionV1: false,
      });

      expect(result.deploy).toBeInstanceOf(Deploy);
      expect(result.transaction).toBeUndefined();
    });
  });

  describe('buildWrapTransaction', () => {
    it('deposit: kind, entryPoint, WCSPR proxy target, empty inner args, attached_value=amount=motesAmount, payment', async () => {
      const spy = jest
        .spyOn(transactionBuilders, 'createSessionWasmTransaction')
        .mockResolvedValue({ fake: 'transaction' } as unknown as Transaction);
      const repo = new DexContractRepository(GRPC_URL, makeDexConfig());

      const result = await repo.buildWrapTransaction({
        network: NETWORK,
        publicKey: PUBLIC_KEY,
        motesAmount: '22000000000',
        useTransactionV1: true,
      });

      expect(result.kind).toBe('wrap');
      expect(result.entryPoint).toBe('deposit');
      expect(result.paymentMotes).toBe(DEX_PAYMENT_AMOUNT.wrap);

      const call = spy.mock.calls[0][0];
      const outerArgs = call.runtimeArgs;
      expect(outerArgs.args.get('package_hash')?.byteArray?.toString()).toBe(
        WrappedCsprContractPackageHash[NETWORK],
      );
      expect(outerArgs.args.get('attached_value')?.ui512?.toString()).toBe('22000000000');
      expect(outerArgs.args.get('amount')?.ui512?.toString()).toBe('22000000000');

      const innerArgs = decodeInnerArgs(outerArgs);
      expect([...innerArgs.args.keys()]).toEqual([]);
    });

    it('supportsTransactionV1=true: returns a real Transaction, kind "wrap"', async () => {
      const repo = new DexContractRepository(GRPC_URL, makeDexConfig());
      jest.spyOn(repo as any, '_getClient').mockReturnValue({
        getStatus: jest.fn().mockResolvedValue({ apiVersion: '2.0.0' }),
      });

      const result = await repo.buildWrapTransaction({
        network: NETWORK,
        publicKey: PUBLIC_KEY,
        motesAmount: '22000000000',
        useTransactionV1: true,
      });

      expect(result.transaction).toBeInstanceOf(Transaction);
      expect(result.deploy).toBeUndefined();
    });

    it('supportsTransactionV1=false: returns a real Deploy, kind "wrap"', async () => {
      const repo = new DexContractRepository(GRPC_URL, makeDexConfig());

      const result = await repo.buildWrapTransaction({
        network: NETWORK,
        publicKey: PUBLIC_KEY,
        motesAmount: '22000000000',
        useTransactionV1: false,
      });

      expect(result.deploy).toBeInstanceOf(Deploy);
      expect(result.transaction).toBeUndefined();
    });

    it('rejects a DexError typed "buildWrapTransaction" naming getProxyWasm when the config omits it', async () => {
      const repo = new DexContractRepository(GRPC_URL, makeDexConfig({ getProxyWasm: undefined }));

      await expect(
        repo.buildWrapTransaction({
          network: NETWORK,
          publicKey: PUBLIC_KEY,
          motesAmount: '22000000000',
          useTransactionV1: true,
        }),
      ).rejects.toMatchObject({
        name: 'DexRepositoryError',
        type: 'buildWrapTransaction',
        message: expect.stringContaining('getProxyWasm'),
      });
    });
  });

  describe('buildUnwrapTransaction', () => {
    it('withdraw: kind, entryPoint, inner args = { amount }, attached_value=amount=0, payment', async () => {
      const spy = jest
        .spyOn(transactionBuilders, 'createSessionWasmTransaction')
        .mockResolvedValue({ fake: 'transaction' } as unknown as Transaction);
      const repo = new DexContractRepository(GRPC_URL, makeDexConfig());

      const result = await repo.buildUnwrapTransaction({
        network: NETWORK,
        publicKey: PUBLIC_KEY,
        rawAmount: '1000',
        useTransactionV1: true,
      });

      expect(result.kind).toBe('unwrap');
      expect(result.entryPoint).toBe('withdraw');
      expect(result.paymentMotes).toBe(DEX_PAYMENT_AMOUNT.unwrap);

      const call = spy.mock.calls[0][0];
      const outerArgs = call.runtimeArgs;
      expect(outerArgs.args.get('attached_value')?.ui512?.toString()).toBe('0');
      expect(outerArgs.args.get('amount')?.ui512?.toString()).toBe('0');

      const innerArgs = decodeInnerArgs(outerArgs);
      expect([...innerArgs.args.keys()]).toEqual(['amount']);
      expect(innerArgs.args.get('amount')?.ui256?.toString()).toBe('1000');
    });

    it('supportsTransactionV1=true: returns a real Transaction, kind "unwrap"', async () => {
      const repo = new DexContractRepository(GRPC_URL, makeDexConfig());
      jest.spyOn(repo as any, '_getClient').mockReturnValue({
        getStatus: jest.fn().mockResolvedValue({ apiVersion: '2.0.0' }),
      });

      const result = await repo.buildUnwrapTransaction({
        network: NETWORK,
        publicKey: PUBLIC_KEY,
        rawAmount: '1000',
        useTransactionV1: true,
      });

      expect(result.transaction).toBeInstanceOf(Transaction);
      expect(result.deploy).toBeUndefined();
    });

    it('supportsTransactionV1=false: returns a real Deploy, kind "unwrap"', async () => {
      const repo = new DexContractRepository(GRPC_URL, makeDexConfig());

      const result = await repo.buildUnwrapTransaction({
        network: NETWORK,
        publicKey: PUBLIC_KEY,
        rawAmount: '1000',
        useTransactionV1: false,
      });

      expect(result.deploy).toBeInstanceOf(Deploy);
      expect(result.transaction).toBeUndefined();
    });
  });
});
