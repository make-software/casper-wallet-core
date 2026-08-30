import { HttpDataProvider } from './data/data-providers/http/http';
import { AccountInfoRepository } from './data/repositories/accountInfo';
import { AppEventsRepository } from './data/repositories/appEvents';
import { ContractPackageRepository } from './data/repositories/contractPackage';
import { DeploysRepository } from './data/repositories/deploys';
import { NftsRepository } from './data/repositories/nfts';
import { OnRampRepository } from './data/repositories/onRamp';
import { SwapRepository } from './data/repositories/swap';
import { TokensRepository } from './data/repositories/tokens';
import { ValidatorsRepository } from './data/repositories/validators';
import { Logger } from './utils/logger';
import {
  CasperWalletApiByNetworkUrl,
  CasperWalletApiByEnvUrl,
} from './domain/constants/casperNetwork';
import { TradeApiUrl, WrappedCsprContractPackageHash } from './domain/constants';
import type { CasperNetwork } from './domain/common/common';
import type { ILogger } from './domain/common/logger';
import type { IEnv } from './domain/env';

/**
 * The repositories a wallet client needs to render its home screen — every one of them
 * SDK-free.
 *
 * Kept apart from {@link setupRepositories}, which also constructs the signing repositories:
 * those link `casper-js-sdk`, a prebuilt UMD bundle with no ESM build and no `sideEffects` flag,
 * so one value import costs ~900 KB no bundler can shake back out. A factory that built both
 * halves in one call would give a client no way to take only this one.
 *
 * Import this module by path (`casper-wallet-core/src/setupData`), not through the package
 * root: the root barrel re-exports `./src/setup`, which links the SDK.
 *
 * `src/sdk-free-modules.test.ts` fails the build if anything reachable from here starts
 * importing the SDK again.
 */
export interface ISetupDataRepositoriesParams {
  debug?: boolean;
  logger?: ILogger;
  casperWalletApiByNetworkUrl?: Record<CasperNetwork, string>;
  /** Environment-based url for Casper Wallet Api. Some API network agnostic and do not belong to any {@link CasperWalletApiByNetworkUrl}. Default env is PRODUCTION (in all places where it is used) */
  casperWalletApiByEnvUrl?: Record<IEnv, string>;
  httpAuthorizationHeader?: string;
  tradeApiByNetworkUrl?: Record<CasperNetwork, string>;
  wrappedCsprContractPackageHash?: Record<CasperNetwork, string>;
}

export const setupDataRepositories = ({
  logger,
  debug,
  casperWalletApiByNetworkUrl = CasperWalletApiByNetworkUrl,
  casperWalletApiByEnvUrl = CasperWalletApiByEnvUrl,
  httpAuthorizationHeader,
  tradeApiByNetworkUrl = TradeApiUrl,
  wrappedCsprContractPackageHash = WrappedCsprContractPackageHash,
}: ISetupDataRepositoriesParams = {}) => {
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
  const swapRepository = new SwapRepository(
    httpDataProvider,
    tradeApiByNetworkUrl,
    wrappedCsprContractPackageHash,
  );

  return {
    accountInfoRepository,
    tokensRepository,
    onRampRepository,
    nftsRepository,
    validatorsRepository,
    deploysRepository,
    appEventsRepository,
    contractPackageRepository,
    swapRepository,
    /** Shared with {@link setupSigningRepositories} so both halves talk through one provider. */
    httpDataProvider,
    /** Shared with {@link setupSigningRepositories}; the resolved logger, never `undefined`. */
    log,
  };
};

export type IDataRepositories = ReturnType<typeof setupDataRepositories>;
