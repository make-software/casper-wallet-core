import { CasperWalletApiByEnvUrl, GrpcUrl } from './domain';
import { setupDataRepositories } from './setupData';
import { setupSigningRepositories } from './setupSigning';
import type { ISetupDataRepositoriesParams } from './setupData';
import type { CasperNetwork, IDexConfig } from './domain';

export interface ISetupRepositoriesParams extends ISetupDataRepositoriesParams {
  grpcUrl?: Record<CasperNetwork, string>;
  dexConfig?: IDexConfig;
}

/**
 * Every repository, signing included.
 *
 * Importing this module links `casper-js-sdk` (~900 KB, one prebuilt UMD bundle that cannot be
 * tree-shaken), because the signing repositories do. A client that only renders balances and
 * account lists should call {@link setupDataRepositories} from `src/setupData` instead and pay
 * nothing for the SDK — see WALLET-1421.
 */
export const setupRepositories = ({
  grpcUrl = GrpcUrl,
  dexConfig,
  ...dataParams
}: ISetupRepositoriesParams = {}) => {
  const { httpDataProvider, log, ...dataRepositories } = setupDataRepositories(dataParams);

  const signingRepositories = setupSigningRepositories({
    httpDataProvider,
    accountInfoRepository: dataRepositories.accountInfoRepository,
    tokensRepository: dataRepositories.tokensRepository,
    contractPackageRepository: dataRepositories.contractPackageRepository,
    casperWalletApiByEnvUrl: dataParams.casperWalletApiByEnvUrl ?? CasperWalletApiByEnvUrl,
    grpcUrl,
    httpAuthorizationHeader: dataParams.httpAuthorizationHeader,
    dexConfig,
    log,
  });

  return { ...dataRepositories, ...signingRepositories };
};
