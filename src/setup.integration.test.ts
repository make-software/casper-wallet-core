import { setupRepositories } from './setup';

describe('setupRepositories (integration)', () => {
  /** Every repository the factory returns, so dropping one from the object fails here. */
  const REPOSITORIES = [
    'accountInfoRepository',
    'appEventsRepository',
    'casperTransactionsRepository',
    'contractPackageRepository',
    'deploysRepository',
    'dexContractRepository',
    'eip712Repository',
    'nftsRepository',
    'onRampRepository',
    'swapRepository',
    'tokensRepository',
    'transactionStatusRepository',
    'txSignatureRequestRepository',
    'validatorsRepository',
  ] as const;

  it('wires every repository it claims to', () => {
    const repos = setupRepositories();

    for (const name of REPOSITORIES) {
      expect(repos[name]).toBeDefined();
    }

    expect(Object.keys(repos).sort()).toEqual([...REPOSITORIES].sort());
  });

  it('honors debug flag (logger is wired)', () => {
    const log = {
      log: jest.fn(),
      logGroup: jest.fn(),
      logGroupEnd: jest.fn(),
      reportError: jest.fn(),
    };
    const repos = setupRepositories({ debug: true, logger: log });
    expect(repos.accountInfoRepository).toBeDefined();
  });

  it('accepts a custom http authorization header', () => {
    expect(() => setupRepositories({ httpAuthorizationHeader: 'Bearer test' })).not.toThrow();
  });
});
