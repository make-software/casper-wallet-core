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
 * These link `casper-js-sdk`, so importing this module costs the whole ~900 KB UMD bundle.
 * That is unavoidable — they exist to talk to the chain — which is exactly why they are here
 * and not in {@link setupDataRepositories}: a surface that only renders balances and account
 * lists must be able to leave this module unimported (WALLET-1421).
 *
 * Takes the data repositories it depends on rather than constructing its own, so both halves
 * share one `HttpDataProvider` and one logger, as they did when a single factory built them all.
 */
export interface ISetupSigningRepositoriesParams extends Pick<
  IDataRepositories,
  'httpDataProvider' | 'accountInfoRepository' | 'tokensRepository' | 'contractPackageRepository'
> {
  casperWalletApiByEnvUrl: Record<IEnv, string>;
  grpcUrl?: Record<CasperNetwork, string>;
  httpAuthorizationHeader?: string;
  /**
   * DEX contract-package hashes, gas price and the proxy WASM loader. Optional as a whole —
   * omit it and `dexContractRepository` still builds approvals but no swap, wrap or unwrap.
   * Supply it and `getProxyWasm` is mandatory; the hashes and gas price default.
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
      wrappedCsprContractPackageHash:
        dexConfig?.wrappedCsprContractPackageHash ?? WrappedCsprContractPackageHash,
      gasPriceTolerance: dexConfig?.gasPriceTolerance ?? 1,
      getProxyWasm: dexConfig?.getProxyWasm,
    },
    httpAuthorizationHeader,
    rpcOptions,
  );
  const casperTransactionsRepository = new CasperTransactionsRepository(grpcUrl, {
    ...rpcOptions,
    ...(httpAuthorizationHeader ? { authorizationHeader: httpAuthorizationHeader } : {}),
  });
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
