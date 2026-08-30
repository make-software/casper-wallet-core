import { setupRepositories } from './setup';
import { CasperTransactionsRepository } from './data/repositories';

describe('setupRepositories', () => {
  it('returns a casperTransactionsRepository', () => {
    const repos = setupRepositories();
    expect(repos.casperTransactionsRepository).toBeInstanceOf(CasperTransactionsRepository);
  });

  it('threads grpcUrl, auth header and rpcOptions', () => {
    const grpcUrl = {
      mainnet: 'https://x/rpc',
      testnet: 'https://x/rpc',
      devnet: 'https://x/rpc',
      integration: 'https://x/rpc',
    };
    const repos = setupRepositories({
      grpcUrl,
      httpAuthorizationHeader: 't',
      rpcOptions: { handlerType: 'axios', referrerMode: 'referer-header' },
    });
    // Bracket notation is load-bearing here: dot notation hits `private` at compile time.
    // eslint-disable-next-line dot-notation
    expect(repos.casperTransactionsRepository['_grpcUrl']).toBe(grpcUrl);
    // eslint-disable-next-line dot-notation
    expect(repos.casperTransactionsRepository['_rpcOptions']).toEqual({
      handlerType: 'axios',
      referrerMode: 'referer-header',
      authorizationHeader: 't',
    });
    // eslint-disable-next-line dot-notation
    expect(repos.dexContractRepository['_rpcOptions']).toEqual({
      handlerType: 'axios',
      referrerMode: 'referer-header',
    });
  });
});
