import { createPrivateKeySigner } from '../index';
import { setupRepositories } from './setup';
import { CasperTransactionsRepository, TransactionStatusRepository } from './data/repositories';

const mockSetReferrer = jest.fn();
const mockSetCustomHeaders = jest.fn();
const mockHttpHandlerCtor = jest.fn();
const mockGetStatus = jest.fn();

jest.mock('casper-js-sdk', () => ({
  ...jest.requireActual('casper-js-sdk'),
  HttpHandler: class {
    constructor(...args: unknown[]) {
      mockHttpHandlerCtor(...args);
    }
    setReferrer = mockSetReferrer;
    setCustomHeaders = mockSetCustomHeaders;
  },
  RpcClient: class {
    getStatus = mockGetStatus;
  },
}));

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

  it('keeps the wallet-API credential off the trade API provider', () => {
    const repos = setupRepositories({ httpAuthorizationHeader: 'secret-token' });

    const defaultHeaders = (provider: unknown) =>
      (provider as { instance: { headers?: Record<string, string> } }).instance.headers;

    // eslint-disable-next-line dot-notation
    const walletProvider = repos.tokensRepository['_httpProvider'];
    // eslint-disable-next-line dot-notation
    const tradeProvider = repos.swapRepository['_httpProvider'];

    expect(tradeProvider).not.toBe(walletProvider);
    expect(defaultHeaders(tradeProvider)?.Authorization).toBeUndefined();
    expect(defaultHeaders(walletProvider)?.Authorization).toBe('secret-token');
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

  it('zero-config stays browser-safe: the RPC client it builds uses fetch + setReferrer', async () => {
    jest.clearAllMocks();
    mockGetStatus.mockResolvedValue({ apiVersion: '2.0.0' });

    const repos = setupRepositories();
    await repos.casperTransactionsRepository.getNetworkApiVersion('mainnet');

    expect(mockHttpHandlerCtor).toHaveBeenCalledWith(expect.any(String), 'fetch');
    expect(mockSetReferrer).toHaveBeenCalledWith('https://casperwallet.io');
    expect(mockSetCustomHeaders).not.toHaveBeenCalled();
  });
});

describe('package root exports', () => {
  it('resolves the signer factory through the root barrel', () => {
    expect(typeof createPrivateKeySigner).toBe('function');
  });
});
