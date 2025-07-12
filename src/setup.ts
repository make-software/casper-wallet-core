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
import { ILogger } from './domain';

export interface ISetupRepositoriesParams {
  debug?: boolean;
  logger?: ILogger;
}

export const setupRepositories = ({ logger, debug }: ISetupRepositoriesParams = {}) => {
  const log = logger ?? new Logger();
  const httpDataProvider = new HttpDataProvider(debug ? log : null);

  const accountInfoRepository = new AccountInfoRepository(httpDataProvider);
  const tokensRepository = new TokensRepository(httpDataProvider);
  const onRampRepository = new OnRampRepository(httpDataProvider);
  const nftsRepository = new NftsRepository(httpDataProvider);
  const validatorsRepository = new ValidatorsRepository(httpDataProvider);
  const deploysRepository = new DeploysRepository(httpDataProvider, accountInfoRepository);
  const appEventsRepository = new AppEventsRepository(httpDataProvider);
  const contractPackageRepository = new ContractPackageRepository(httpDataProvider);
  const txSignatureRequestRepository = new TxSignatureRequestRepository(
    httpDataProvider,
    accountInfoRepository,
    tokensRepository,
    contractPackageRepository,
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
