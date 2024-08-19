import { HttpDataProvider } from './data/data-providers';
import {
  DeploysRepository,
  TokensRepository,
  NftsRepository,
  ValidatorsRepository,
  OnRampRepository,
  AccountInfoRepository,
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

  return {
    accountInfoRepository,
    tokensRepository,
    onRampRepository,
    nftsRepository,
    validatorsRepository,
    deploysRepository,
  };
};
