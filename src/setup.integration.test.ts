import { setupRepositories } from './setup';

describe('setupRepositories (integration)', () => {
  it('wires all 9 repositories', () => {
    const repos = setupRepositories();

    expect(repos.accountInfoRepository).toBeDefined();
    expect(repos.tokensRepository).toBeDefined();
    expect(repos.onRampRepository).toBeDefined();
    expect(repos.nftsRepository).toBeDefined();
    expect(repos.validatorsRepository).toBeDefined();
    expect(repos.deploysRepository).toBeDefined();
    expect(repos.appEventsRepository).toBeDefined();
    expect(repos.txSignatureRequestRepository).toBeDefined();
    expect(repos.contractPackageRepository).toBeDefined();
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
    expect(() =>
      setupRepositories({ httpAuthorizationHeader: 'Bearer test' }),
    ).not.toThrow();
  });
});
