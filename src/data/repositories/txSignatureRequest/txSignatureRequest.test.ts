import { TxSignatureRequestRepository } from './index';
import { AccountInfoRepository } from '../accountInfo';
import { TokensRepository } from '../tokens';
import { ContractPackageRepository } from '../contractPackage';
import { createMockHttpProvider } from '../../../__test-utils__';
import {
  CasperWalletApiByEnvUrl,
  CasperWalletApiByNetworkUrl,
  GrpcUrl,
  InvalidTransactionJsonError,
  TxSignatureRequestError,
} from '../../../domain';

const SIGNING_KEY = '0106956df3aba7115e28271d053205ec7f33cab259f8e2da2f38150f0ece65a2a8';

describe('TxSignatureRequestRepository', () => {
  const buildRepo = () => {
    const http = createMockHttpProvider();
    const accountInfoRepository = new AccountInfoRepository(http, CasperWalletApiByNetworkUrl);
    const tokensRepository = new TokensRepository(http, CasperWalletApiByNetworkUrl);
    const contractPackageRepository = new ContractPackageRepository(http, CasperWalletApiByNetworkUrl);
    const repo = new TxSignatureRequestRepository(
      http,
      accountInfoRepository,
      tokensRepository,
      contractPackageRepository,
      CasperWalletApiByEnvUrl,
      GrpcUrl,
    );
    return { repo, http };
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

  it('returns a known error type', () => {
    expect(new InvalidTransactionJsonError('test')).toBeInstanceOf(Error);
  });
});
