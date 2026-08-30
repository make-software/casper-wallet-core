import { GrpcUrl } from '../../../domain';
import { CasperTransactionsRepository } from './index';

const mockGetStatus = jest.fn();
const mockSetReferrer = jest.fn();
const mockSetCustomHeaders = jest.fn();
const mockHttpHandlerCtor = jest.fn();

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

const nodeStatus = (isoDate: string, apiVersion = '2.0.0') => ({
  apiVersion,
  lastProgress: { toDate: () => new Date(isoDate) },
});

describe('CasperTransactionsRepository rpc plumbing', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses node time when the node is ahead of local-2s', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:10.000Z'));
    mockGetStatus.mockResolvedValue(nodeStatus('2026-01-01T00:00:09.000Z'));
    const repo = new CasperTransactionsRepository(GrpcUrl);
    await expect(repo.getDateForTransaction('mainnet')).resolves.toBe('2026-01-01T00:00:09.000Z');
    jest.useRealTimers();
  });

  it('falls back to local-2s when the node lags or errors', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:10.000Z'));
    mockGetStatus.mockResolvedValue(nodeStatus('2026-01-01T00:00:01.000Z'));
    const repo = new CasperTransactionsRepository(GrpcUrl);
    await expect(repo.getDateForTransaction('mainnet')).resolves.toBe('2026-01-01T00:00:08.000Z');
    mockGetStatus.mockRejectedValue(new Error('down'));
    await expect(repo.getDateForTransaction('mainnet')).resolves.toBe('2026-01-01T00:00:08.000Z');
    jest.useRealTimers();
  });

  it('getNetworkApiVersion returns apiVersion and wraps RPC failures', async () => {
    mockGetStatus.mockResolvedValue(nodeStatus('2026-01-01T00:00:00.000Z', '1.5.8'));
    const repo = new CasperTransactionsRepository(GrpcUrl);
    await expect(repo.getNetworkApiVersion('testnet')).resolves.toBe('1.5.8');

    mockGetStatus.mockRejectedValue(new Error('down'));
    await expect(repo.getNetworkApiVersion('testnet')).rejects.toMatchObject({
      name: 'CasperTransactionsError',
      type: 'getNetworkApiVersion',
    });
  });

  it("default rpc options: 'fetch' handler + setReferrer, no Referer header", async () => {
    mockGetStatus.mockResolvedValue(nodeStatus('2026-01-01T00:00:00.000Z'));
    await new CasperTransactionsRepository(GrpcUrl).getNetworkApiVersion('mainnet');
    expect(mockHttpHandlerCtor).toHaveBeenCalledWith(GrpcUrl.mainnet, 'fetch');
    expect(mockSetReferrer).toHaveBeenCalledWith('https://casperwallet.io');
    expect(mockSetCustomHeaders).not.toHaveBeenCalled();
  });

  it("mobile rpc options: 'axios' handler + literal Referer header (+auth)", async () => {
    mockGetStatus.mockResolvedValue(nodeStatus('2026-01-01T00:00:00.000Z'));
    const repo = new CasperTransactionsRepository(GrpcUrl, {
      handlerType: 'axios',
      referrerMode: 'referer-header',
      authorizationHeader: 'token',
    });
    await repo.getNetworkApiVersion('mainnet');
    expect(mockHttpHandlerCtor).toHaveBeenCalledWith(GrpcUrl.mainnet, 'axios');
    expect(mockSetCustomHeaders).toHaveBeenCalledWith({
      Referer: 'https://casperwallet.io',
      Authorization: 'token',
    });
    expect(mockSetReferrer).not.toHaveBeenCalled();
  });
});
