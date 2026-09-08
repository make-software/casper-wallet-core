import { TxSignatureRequestRepository } from './index';
import { AccountInfoRepository } from '../accountInfo';
import { TokensRepository } from '../tokens';
import { ContractPackageRepository } from '../contractPackage';
import { createMockHttpProvider } from '../../../__test-utils__';
import * as fs from 'fs';
import * as path from 'path';
import {
  CasperWalletApiByEnvUrl,
  CasperWalletApiByNetworkUrl,
  GrpcUrl,
  InvalidTransactionJsonError,
  TxSignatureRequestError,
} from '../../../domain';

const SIGNING_KEY = '0106956df3aba7115e28271d053205ec7f33cab259f8e2da2f38150f0ece65a2a8';

const NATIVE_TRANSFER_TX = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../../__fixtures__/transactions/cspr-native-transfer.json'),
    'utf8',
  ),
);

describe('TxSignatureRequestRepository', () => {
  const buildRepo = () => {
    const http = createMockHttpProvider();
    const accountInfoRepository = new AccountInfoRepository(http, CasperWalletApiByNetworkUrl);
    const tokensRepository = new TokensRepository(http, CasperWalletApiByNetworkUrl);
    const contractPackageRepository = new ContractPackageRepository(
      http,
      CasperWalletApiByNetworkUrl,
    );
    const repo = new TxSignatureRequestRepository(
      http,
      accountInfoRepository,
      tokensRepository,
      contractPackageRepository,
      CasperWalletApiByEnvUrl,
      GrpcUrl,
    );
    return { repo, http, accountInfoRepository };
  };

  it('throws TxSignatureRequestError for invalid transaction JSON', async () => {
    const { repo } = buildRepo();

    await expect(
      repo.prepareSignatureRequest({
        transactionJson: '{not valid}' as never,
        signingPublicKeyHex: SIGNING_KEY,
      }),
    ).rejects.toBeInstanceOf(TxSignatureRequestError);
  });

  it('wraps InvalidTransactionJsonError when JSON is null', async () => {
    const { repo } = buildRepo();

    await expect(
      repo.prepareSignatureRequest({
        transactionJson: null as never,
        signingPublicKeyHex: SIGNING_KEY,
      }),
    ).rejects.toBeDefined();
  });

  it('keeps the proxy header off the nested accounts lookup', async () => {
    const { repo, accountInfoRepository } = buildRepo();
    const accountsSpy = jest.spyOn(accountInfoRepository, 'getAccountsInfo').mockResolvedValue({});
    // The sender lookup that follows talks to a node over RPC; keep the test off the network.
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'));

    await repo.prepareSignatureRequest({
      transactionJson: NATIVE_TRANSFER_TX,
      signingPublicKeyHex: SIGNING_KEY,
      withProxyHeader: false,
    });

    expect(accountsSpy).toHaveBeenCalledWith(expect.objectContaining({ withProxyHeader: false }));
  });

  it('returns a known error type', () => {
    expect(new InvalidTransactionJsonError('test')).toBeInstanceOf(Error);
  });
});
