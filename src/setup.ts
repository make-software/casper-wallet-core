import { HttpDataProvider } from './data/data-providers';
import {
  DeploysRepository,
  TokensRepository,
  NftsRepository,
  ValidatorsRepository,
  OnRampRepository,
  AccountInfoRepository,
  AppEventsRepository,
  TxSignatureRequestRepository,
  ContractPackageRepository,
} from './data/repositories';
import { Logger } from './utils';
import {
  CasperNetwork,
  CasperWalletApiByNetworkUrl,
  CasperWalletApiByEnvUrl,
  GrpcUrl,
  ILogger,
} from './domain';
import { IEnv } from './domain/env';

export interface ISetupRepositoriesParams {
  debug?: boolean;
  logger?: ILogger;
  casperWalletApiByNetworkUrl?: Record<CasperNetwork, string>;
  /** Environment-based url for Casper Wallet Api. Some API network agnostic and do not belong to any {@link CasperWalletApiByNetworkUrl}. Default env is PRODUCTION (in all places where it is used) */
  casperWalletApiByEnvUrl?: Record<IEnv, string>;
  grpcUrl?: Record<CasperNetwork, string>;
  httpAuthorizationHeader?: string;
}

export const setupRepositories = ({
  logger,
  debug,
  casperWalletApiByNetworkUrl = CasperWalletApiByNetworkUrl,
  casperWalletApiByEnvUrl = CasperWalletApiByEnvUrl,
  grpcUrl = GrpcUrl,
  httpAuthorizationHeader,
}: ISetupRepositoriesParams = {}) => {
  const log = logger ?? new Logger();
  const httpDataProvider = new HttpDataProvider(debug ? log : null);

  if (httpAuthorizationHeader) {
    httpDataProvider.setAuthHeader(httpAuthorizationHeader);
  }

  const accountInfoRepository = new AccountInfoRepository(
    httpDataProvider,
    casperWalletApiByNetworkUrl,
  );
  const tokensRepository = new TokensRepository(httpDataProvider, casperWalletApiByNetworkUrl);
  const onRampRepository = new OnRampRepository(httpDataProvider);
  const nftsRepository = new NftsRepository(httpDataProvider, casperWalletApiByNetworkUrl);
  const validatorsRepository = new ValidatorsRepository(
    httpDataProvider,
    casperWalletApiByNetworkUrl,
  );
  const deploysRepository = new DeploysRepository(
    httpDataProvider,
    accountInfoRepository,
    casperWalletApiByNetworkUrl,
  );
  const appEventsRepository = new AppEventsRepository(httpDataProvider, casperWalletApiByEnvUrl);
  const contractPackageRepository = new ContractPackageRepository(
    httpDataProvider,
    casperWalletApiByNetworkUrl,
  );
  const txSignatureRequestRepository = new TxSignatureRequestRepository(
    httpDataProvider,
    accountInfoRepository,
    tokensRepository,
    contractPackageRepository,
    casperWalletApiByEnvUrl,
    grpcUrl,
    httpAuthorizationHeader,
  );

  return {
    accountInfoRepository,
    tokensRepository,
    onRampRepository,
    nftsRepository,
    validatorsRepository,
    deploysRepository,
    appEventsRepository,
    txSignatureRequestRepository,
    contractPackageRepository,
  };
};
