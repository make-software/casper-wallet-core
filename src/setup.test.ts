import { setupRepositories } from './setup';
import { CasperTransactionsRepository, TransactionStatusRepository } from './data/repositories';

describe('setupRepositories', () => {
  it('returns a casperTransactionsRepository', () => {
    const repos = setupRepositories();
    expect(repos.casperTransactionsRepository).toBeInstanceOf(CasperTransactionsRepository);
  });

  it('returns the transactionStatusRepository the flow layer settles through', () => {
    const repos = setupRepositories();
    expect(repos.transactionStatusRepository).toBeInstanceOf(TransactionStatusRepository);
  });

  it('gives the swap and dex repositories the same wrapped-CSPR contract package hash', () => {
    const wrappedCsprContractPackageHash = {
      mainnet: 'aa',
      testnet: 'bb',
      devnet: 'cc',
      integration: 'dd',
    };
    const repos = setupRepositories({ wrappedCsprContractPackageHash });

    // Bracket notation is load-bearing here: dot notation hits `private` at compile time.
    // eslint-disable-next-line dot-notation
    expect(repos.dexContractRepository['_dexConfig'].wrappedCsprContractPackageHash).toBe(
      wrappedCsprContractPackageHash,
    );
    // eslint-disable-next-line dot-notation
    expect(repos.swapRepository['_wrappedCsprContractPackageHash']).toBe(
      wrappedCsprContractPackageHash,
    );
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
