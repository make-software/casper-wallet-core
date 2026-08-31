import { CasperWalletApiByEnvUrl, GrpcUrl, WrappedCsprContractPackageHash } from './domain';
import { setupDataRepositories } from './setupData';
import { setupSigningRepositories } from './setupSigning';
import type { ISetupDataRepositoriesParams } from './setupData';
import type { CasperNetwork, ICasperRpcOptions, IDexConfig } from './domain';

export interface ISetupRepositoriesParams extends ISetupDataRepositoriesParams {
  grpcUrl?: Record<CasperNetwork, string>;
  dexConfig?: IDexConfig;
  /**
   * Node-RPC client behavior for casperTransactionsRepository and dexContractRepository.
   * Browser-safe defaults; mobile passes axios + referer-header.
   */
  rpcOptions?: Omit<ICasperRpcOptions, 'authorizationHeader'>;
}

/**
 * Every repository, signing included.
 *
 * Importing this module links `casper-js-sdk` (~900 KB, one prebuilt UMD bundle that cannot be
 * tree-shaken), because the signing repositories do. A client that only renders balances and
 * account lists should call {@link setupDataRepositories} from `src/setupData` instead and pay
 * nothing for the SDK.
 */
export const setupRepositories = ({
  grpcUrl = GrpcUrl,
  dexConfig,
  rpcOptions,
  ...dataParams
}: ISetupRepositoriesParams = {}) => {
  // One hash for both halves: `SwapRepository` keys its synthetic native-CSPR token off it and
  // `DexContractRepository` validates swap routes against it, so a divergence rejects every
  // native-CSPR swap as an invalid route.
  const wrappedCsprContractPackageHash =
    dataParams.wrappedCsprContractPackageHash ?? WrappedCsprContractPackageHash;

  const { httpDataProvider, log, ...dataRepositories } = setupDataRepositories({
    ...dataParams,
    wrappedCsprContractPackageHash,
  });

  const signingRepositories = setupSigningRepositories({
    httpDataProvider,
    accountInfoRepository: dataRepositories.accountInfoRepository,
    tokensRepository: dataRepositories.tokensRepository,
    contractPackageRepository: dataRepositories.contractPackageRepository,
    casperWalletApiByEnvUrl: dataParams.casperWalletApiByEnvUrl ?? CasperWalletApiByEnvUrl,
    grpcUrl,
    wrappedCsprContractPackageHash,
    httpAuthorizationHeader: dataParams.httpAuthorizationHeader,
    dexConfig,
    rpcOptions,
    log,
  });

  return { ...dataRepositories, ...signingRepositories };
};
