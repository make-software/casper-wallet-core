import {
  CasperNetwork,
  CasperSdkNetworkName,
  CSPR_NATIVE_TOKEN_ID,
  DEX_PAYMENT_AMOUNT,
  DexError,
  DexErrorType,
  IBuildApprovalParams,
  IBuildSwapParams,
  IBuildUnwrapParams,
  IBuildWrapParams,
  IBuiltDexTransaction,
  IDexConfig,
  IDexContractRepository,
  isDexError,
  SwapQuoteType,
} from '../../../domain';
import {
  Args,
  CLTypeKey,
  CLTypeUInt8,
  CLValue,
  HttpHandler,
  Key,
  PublicKey,
  RpcClient,
} from 'casper-js-sdk';
import { hexToBytes } from '@noble/hashes/utils';
import Decimal from 'decimal.js';
import {
  getContractHash,
  getDictionaryValue,
  keysToHex,
} from '../../../utils/casperSdk/dex-contract';
import { calculateMaxAmountWithSlippage, calculateMinAmountWithSlippage } from '../../../utils';
import {
  createContractDeploy,
  createContractPackageCallTransaction,
  createSessionWasmTransaction,
  createWASMContractDeploy,
} from './transactionBuilders';

export class DexContractRepository implements IDexContractRepository {
  constructor(
    private _grpcUrl: Record<CasperNetwork, string>,
    private _dexConfig: Required<
      Pick<
        IDexConfig,
        'tradeContractPackageHash' | 'wrappedCsprContractPackageHash' | 'gasPriceTolerance'
      >
    > &
      Pick<IDexConfig, 'getProxyWasm'>,
    private _httpAuthorizationHeader?: string,
  ) {}

  async getAllowance(params: {
    network: CasperNetwork;
    contractPackageHash: string;
    publicKey: string;
    operatorContractPackageHash?: string;
  }): Promise<string> {
    const { network, contractPackageHash, publicKey, operatorContractPackageHash } = params;

    try {
      const client = this._getClient(network);
      const { contractHash } = await getContractHash(contractPackageHash, client);

      const key = CLValue.newCLKey(
        Key.newKey(PublicKey.fromHex(publicKey).accountHash().toPrefixedString()),
      );
      const operator = CLValue.newCLKey(
        Key.newKey(
          operatorContractPackageHash ?? this._dexConfig.tradeContractPackageHash[network],
        ),
      );

      const dictKey = keysToHex(key, operator);

      const allowanceResult = await getDictionaryValue(client, contractHash, 'allowances', dictKey);

      return allowanceResult?.toString() ?? '';
    } catch {
      // An unreadable allowance resolves to '', which `checkApprovalRequired` reads as
      // "not enough" rather than surfacing an error.
      return '';
    }
  }

  async checkApprovalRequired(params: {
    network: CasperNetwork;
    contractPackageHash: string;
    publicKey: string;
    requiredAmount: string;
  }): Promise<boolean> {
    const { network, contractPackageHash, publicKey, requiredAmount } = params;

    // CSPR (wrapped as WCSPR on-chain) doesn't require approval.
    if (contractPackageHash === this._dexConfig.wrappedCsprContractPackageHash[network]) {
      return false;
    }

    try {
      const allowance = await this.getAllowance({
        network,
        contractPackageHash,
        publicKey,
        operatorContractPackageHash: this._dexConfig.tradeContractPackageHash[network],
      });

      return new Decimal(allowance || '0').lt(new Decimal(requiredAmount || '0'));
    } catch {
      // Assume approval is required if we can't check.
      return true;
    }
  }

  async getLatestBlockTime(params: { network: CasperNetwork }): Promise<number> {
    try {
      const client = this._getClient(params.network);
      const result = await client.getLatestBlock();

      return result.block.timestamp.toMilliseconds();
    } catch (e) {
      this._processError(e, 'getLatestBlockTime');
    }
  }

  /** Direct contract-package call, no WASM proxy. Returns an unsigned transaction or deploy. */
  async buildApprovalTransaction(params: IBuildApprovalParams): Promise<IBuiltDexTransaction> {
    const { network, publicKey, contractPackageHash, amount, useTransactionV1 } = params;

    try {
      const entryPoint = 'approve';
      const paymentMotes = DEX_PAYMENT_AMOUNT.approve;
      const chainName = CasperSdkNetworkName[network];

      const runtimeArgs = Args.fromMap({
        spender: CLValue.newCLKey(Key.newKey(this._dexConfig.tradeContractPackageHash[network])),
        amount: CLValue.newCLUInt256(amount),
      });

      if (useTransactionV1) {
        const transaction = createContractPackageCallTransaction({
          publicKey,
          chainName,
          entryPoint,
          paymentMotes,
          runtimeArgs,
          contractPackageHash,
          gasPriceTolerance: this._dexConfig.gasPriceTolerance,
        });

        return { kind: 'approve', entryPoint, paymentMotes, transaction };
      }

      const deploy = createContractDeploy({
        publicKey,
        chainName,
        paymentMotes,
        entryPoint,
        runtimeArgs,
        contractPackageHash,
        gasPriceTolerance: this._dexConfig.gasPriceTolerance,
      });

      return { kind: 'approve', entryPoint, paymentMotes, deploy };
    } catch (e) {
      this._processError(e, 'buildApprovalTransaction');
    }
  }

  /**
   * WASM-proxy call. The entry-point names and the inner-arg names/order below are what the
   * deployed trade contract expects — changing either breaks the on-chain call.
   */
  async buildSwapTransaction(params: IBuildSwapParams): Promise<IBuiltDexTransaction> {
    const {
      network,
      publicKey,
      firstToken,
      secondToken,
      path,
      quoteType,
      slippage,
      deadline,
      useTransactionV1,
    } = params;

    try {
      const firstTokenAmountRaw = firstToken.amountRaw;
      const secondTokenAmountRaw = secondToken.amountRaw;

      const firstTokenAmountRawMax = calculateMaxAmountWithSlippage(firstTokenAmountRaw, slippage);
      const secondTokenAmountRawMin = calculateMinAmountWithSlippage(
        secondTokenAmountRaw,
        slippage,
      );

      const isFirstTokenNative = firstToken.id === CSPR_NATIVE_TOKEN_ID;
      const isSecondTokenNative = secondToken.id === CSPR_NATIVE_TOKEN_ID;
      const isBothTokensNotNative = !isFirstTokenNative && !isSecondTokenNative;

      // A CSPR-for-CSPR swap is invalid, and has to be rejected before the chain below —
      // `isFirstTokenNative` would otherwise claim it and the final fallback is unreachable.
      let entryPoint: string;
      if (isFirstTokenNative && isSecondTokenNative) {
        throw new Error('Invalid swap entry point');
      } else if (isFirstTokenNative) {
        entryPoint =
          quoteType === SwapQuoteType.ExactIn
            ? 'swap_exact_cspr_for_tokens'
            : 'swap_cspr_for_exact_tokens';
      } else if (isSecondTokenNative) {
        entryPoint =
          quoteType === SwapQuoteType.ExactIn
            ? 'swap_exact_tokens_for_cspr'
            : 'swap_tokens_for_exact_cspr';
      } else if (isBothTokensNotNative) {
        entryPoint =
          quoteType === SwapQuoteType.ExactIn
            ? 'swap_exact_tokens_for_tokens'
            : 'swap_tokens_for_exact_tokens';
      } else {
        throw new Error('Invalid swap entry point');
      }

      if (!this._dexConfig.getProxyWasm) {
        throw new Error(
          'dexConfig.getProxyWasm is required to build swap transactions (proxy_caller.wasm bytes)',
        );
      }

      const deadlineArg = Date.now() + 1000 * 60 * deadline;
      const account = PublicKey.fromHex(publicKey).accountHash().toPrefixedString();

      const amountArg = isFirstTokenNative
        ? quoteType === SwapQuoteType.ExactIn
          ? firstTokenAmountRaw
          : firstTokenAmountRawMax
        : '0';

      const rawArgsBytes = Args.fromMap({
        path: CLValue.newCLList(
          CLTypeKey,
          path.map(item => CLValue.newCLKey(Key.newKey(item))),
        ),
        to: CLValue.newCLKey(Key.newKey(account)),
        deadline: CLValue.newCLUint64(deadlineArg),

        ...(isFirstTokenNative && quoteType === SwapQuoteType.ExactIn
          ? { amount_out_min: CLValue.newCLUInt256(secondTokenAmountRawMin) }
          : {}),

        ...(isFirstTokenNative && quoteType === SwapQuoteType.ExactOut
          ? { amount_out: CLValue.newCLUInt256(secondTokenAmountRaw) }
          : {}),

        ...((isSecondTokenNative || isBothTokensNotNative) && quoteType === SwapQuoteType.ExactIn
          ? {
              amount_in: CLValue.newCLUInt256(firstTokenAmountRaw),
              amount_out_min: CLValue.newCLUInt256(secondTokenAmountRawMin),
            }
          : {}),

        ...((isSecondTokenNative || isBothTokensNotNative) && quoteType === SwapQuoteType.ExactOut
          ? {
              amount_in_max: CLValue.newCLUInt256(firstTokenAmountRawMax),
              amount_out: CLValue.newCLUInt256(secondTokenAmountRaw),
            }
          : {}),
      }).toBytes();

      const argsBytes = Array.from(rawArgsBytes, byte => CLValue.newCLUint8(byte));

      const wasmBinary = await this._dexConfig.getProxyWasm();

      const runtimeArgs = Args.fromMap({
        package_hash: CLValue.newCLByteArray(
          hexToBytes(this._dexConfig.tradeContractPackageHash[network].replace('hash-', '')),
        ),
        entry_point: CLValue.newCLString(entryPoint),
        args: CLValue.newCLList(CLTypeUInt8, argsBytes),
        attached_value: CLValue.newCLUInt512(amountArg),
        amount: CLValue.newCLUInt512(amountArg),
      });

      const paymentMotes = isBothTokensNotNative
        ? DEX_PAYMENT_AMOUNT.swapTokenForToken
        : DEX_PAYMENT_AMOUNT.swapCsprForToken;
      const chainName = CasperSdkNetworkName[network];

      if (useTransactionV1) {
        const transaction = await createSessionWasmTransaction({
          publicKey,
          chainName,
          paymentMotes,
          wasmBinary,
          runtimeArgs,
          gasPriceTolerance: this._dexConfig.gasPriceTolerance,
          rpcClient: this._getClient(network),
        });

        return { kind: 'swap', entryPoint, paymentMotes, transaction };
      }

      const deploy = createWASMContractDeploy({
        publicKey,
        chainName,
        paymentMotes,
        wasmBinary,
        runtimeArgs,
        gasPriceTolerance: this._dexConfig.gasPriceTolerance,
      });

      return { kind: 'swap', entryPoint, paymentMotes, deploy };
    } catch (e) {
      this._processError(e, 'buildSwapTransaction');
    }
  }

  /**
   * WASM-proxy call to WCSPR's `deposit`. The entry point takes no named args — the amount
   * minted is whatever CSPR the proxy attaches.
   */
  async buildWrapTransaction(params: IBuildWrapParams): Promise<IBuiltDexTransaction> {
    const { network, publicKey, motesAmount, useTransactionV1 } = params;

    try {
      if (!this._dexConfig.getProxyWasm) {
        throw new Error(
          'dexConfig.getProxyWasm is required to build wrap transactions (proxy_caller.wasm bytes)',
        );
      }

      const entryPoint = 'deposit';

      const rawArgsBytes = Args.fromMap({}).toBytes();
      const argsBytes = Array.from(rawArgsBytes, byte => CLValue.newCLUint8(byte));

      const wasmBinary = await this._dexConfig.getProxyWasm();

      const runtimeArgs = Args.fromMap({
        package_hash: CLValue.newCLByteArray(
          hexToBytes(this._dexConfig.wrappedCsprContractPackageHash[network].replace('hash-', '')),
        ),
        entry_point: CLValue.newCLString(entryPoint),
        args: CLValue.newCLList(CLTypeUInt8, argsBytes),
        attached_value: CLValue.newCLUInt512(motesAmount),
        amount: CLValue.newCLUInt512(motesAmount),
      });

      const paymentMotes = DEX_PAYMENT_AMOUNT.wrap;
      const chainName = CasperSdkNetworkName[network];

      if (useTransactionV1) {
        const transaction = await createSessionWasmTransaction({
          publicKey,
          chainName,
          paymentMotes,
          wasmBinary,
          runtimeArgs,
          gasPriceTolerance: this._dexConfig.gasPriceTolerance,
          rpcClient: this._getClient(network),
        });

        return { kind: 'wrap', entryPoint, paymentMotes, transaction };
      }

      const deploy = createWASMContractDeploy({
        publicKey,
        chainName,
        paymentMotes,
        wasmBinary,
        runtimeArgs,
        gasPriceTolerance: this._dexConfig.gasPriceTolerance,
      });

      return { kind: 'wrap', entryPoint, paymentMotes, deploy };
    } catch (e) {
      this._processError(e, 'buildWrapTransaction');
    }
  }

  /**
   * WASM-proxy call to WCSPR's `withdraw`. Burns the caller's own WCSPR, so nothing is
   * attached to the proxy call.
   */
  async buildUnwrapTransaction(params: IBuildUnwrapParams): Promise<IBuiltDexTransaction> {
    const { network, publicKey, rawAmount, useTransactionV1 } = params;

    try {
      if (!this._dexConfig.getProxyWasm) {
        throw new Error(
          'dexConfig.getProxyWasm is required to build unwrap transactions (proxy_caller.wasm bytes)',
        );
      }

      const entryPoint = 'withdraw';

      const rawArgsBytes = Args.fromMap({
        amount: CLValue.newCLUInt256(rawAmount),
      }).toBytes();
      const argsBytes = Array.from(rawArgsBytes, byte => CLValue.newCLUint8(byte));

      const wasmBinary = await this._dexConfig.getProxyWasm();

      const runtimeArgs = Args.fromMap({
        package_hash: CLValue.newCLByteArray(
          hexToBytes(this._dexConfig.wrappedCsprContractPackageHash[network].replace('hash-', '')),
        ),
        entry_point: CLValue.newCLString(entryPoint),
        args: CLValue.newCLList(CLTypeUInt8, argsBytes),
        attached_value: CLValue.newCLUInt512(0),
        amount: CLValue.newCLUInt512(0),
      });

      const paymentMotes = DEX_PAYMENT_AMOUNT.unwrap;
      const chainName = CasperSdkNetworkName[network];

      if (useTransactionV1) {
        const transaction = await createSessionWasmTransaction({
          publicKey,
          chainName,
          paymentMotes,
          wasmBinary,
          runtimeArgs,
          gasPriceTolerance: this._dexConfig.gasPriceTolerance,
          rpcClient: this._getClient(network),
        });

        return { kind: 'unwrap', entryPoint, paymentMotes, transaction };
      }

      const deploy = createWASMContractDeploy({
        publicKey,
        chainName,
        paymentMotes,
        wasmBinary,
        runtimeArgs,
        gasPriceTolerance: this._dexConfig.gasPriceTolerance,
      });

      return { kind: 'unwrap', entryPoint, paymentMotes, deploy };
    } catch (e) {
      this._processError(e, 'buildUnwrapTransaction');
    }
  }

  private _getClient(network: CasperNetwork): RpcClient {
    const handler = new HttpHandler(this._grpcUrl[network], 'fetch');

    if (this._httpAuthorizationHeader) {
      handler.setCustomHeaders({ Authorization: this._httpAuthorizationHeader });
    }

    return new RpcClient(handler);
  }

  private _processError(e: unknown, type: DexErrorType): never {
    if (isDexError(e)) {
      throw e;
    }

    throw new DexError(e, type);
  }
}
