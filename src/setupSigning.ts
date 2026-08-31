import {
  CasperTransactionsRepository,
  DexContractRepository,
  EIP712Repository,
  TransactionStatusRepository,
  TxSignatureRequestRepository,
} from './data/repositories';
import { GrpcUrl, TradeContractPackageHash, WrappedCsprContractPackageHash } from './domain';
import type { IDataRepositories } from './setupData';
import type { CasperNetwork, ICasperRpcOptions, ILogger } from './domain';
import type { IDexConfig } from './domain';
import type { IEnv } from './domain/env';

/**
 * The repositories that build, parse and sign transactions.
 *
 * These link `casper-js-sdk`, so importing this module costs the whole ~900 KB UMD bundle. They
 * are kept out of {@link setupDataRepositories} so a surface that only renders balances and
 * account lists can leave this module unimported.
 *
 * Takes the data repositories it depends on rather than constructing its own, so both halves
 * share one `HttpDataProvider` and one logger.
 */
export interface ISetupSigningRepositoriesParams extends Pick<
  IDataRepositories,
  'httpDataProvider' | 'accountInfoRepository' | 'tokensRepository' | 'contractPackageRepository'
> {
  casperWalletApiByEnvUrl: Record<IEnv, string>;
  grpcUrl?: Record<CasperNetwork, string>;
  /**
   * The one wrapped-CSPR contract package hash for this setup. `setupRepositories` passes the
   * same value to `setupDataRepositories`, which `SwapRepository` keys its synthetic native-CSPR
   * token off — the two must not be able to disagree.
   */
  wrappedCsprContractPackageHash?: Record<CasperNetwork, string>;
  httpAuthorizationHeader?: string;
  /**
   * The trade contract-package hash, gas price and the proxy WASM loader. Optional as a whole —
   * omit it and `dexContractRepository` still builds approvals but no swap, wrap or unwrap.
   * Supply it and `getProxyWasm` is mandatory; the hash and gas price default.
   */
  dexConfig?: IDexConfig;
  /**
   * Node-RPC client behavior for casperTransactionsRepository and dexContractRepository.
   * Browser-safe defaults; mobile passes axios + referer-header.
   */
  rpcOptions?: Omit<ICasperRpcOptions, 'authorizationHeader'>;
  log: ILogger;
}

export const setupSigningRepositories = ({
  httpDataProvider,
  accountInfoRepository,
  tokensRepository,
  contractPackageRepository,
  casperWalletApiByEnvUrl,
  grpcUrl = GrpcUrl,
  wrappedCsprContractPackageHash = WrappedCsprContractPackageHash,
  httpAuthorizationHeader,
  dexConfig,
  rpcOptions,
  log,
}: ISetupSigningRepositoriesParams) => {
  const txSignatureRequestRepository = new TxSignatureRequestRepository(
    httpDataProvider,
    accountInfoRepository,
    tokensRepository,
    contractPackageRepository,
    casperWalletApiByEnvUrl,
    grpcUrl,
    httpAuthorizationHeader,
  );
  const eip712Repository = new EIP712Repository(
    accountInfoRepository,
    contractPackageRepository,
    log,
  );
  const dexContractRepository = new DexContractRepository(
    grpcUrl,
    {
      tradeContractPackageHash: dexConfig?.tradeContractPackageHash ?? TradeContractPackageHash,
      wrappedCsprContractPackageHash,
      gasPriceTolerance: dexConfig?.gasPriceTolerance ?? 1,
      getProxyWasm: dexConfig?.getProxyWasm,
    },
    httpAuthorizationHeader,
    rpcOptions,
    log,
  );
  const casperTransactionsRepository = new CasperTransactionsRepository(
    grpcUrl,
    {
      ...rpcOptions,
      ...(httpAuthorizationHeader ? { authorizationHeader: httpAuthorizationHeader } : {}),
    },
    log,
  );
  const transactionStatusRepository = new TransactionStatusRepository(grpcUrl, {
    ...rpcOptions,
    authorizationHeader: httpAuthorizationHeader,
  });

  return {
    txSignatureRequestRepository,
    eip712Repository,
    dexContractRepository,
    casperTransactionsRepository,
    transactionStatusRepository,
  };
};
