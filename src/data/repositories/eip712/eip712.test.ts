import { PrivateKey, KeyAlgorithm } from 'casper-js-sdk';
import { PermitTypes, buildDomain } from '@casper-ecosystem/casper-eip-712';
import { EIP712Repository } from './index';
import { AccountInfoRepository } from '../accountInfo';
import { ContractPackageRepository } from '../contractPackage';
import { createMockHttpProvider } from '../../../__test-utils__';
import { CasperWalletApiByNetworkUrl, EIP712Error, isEIP712Error } from '../../../domain';

const DOMAIN = buildDomain('CasperSwap', '1', 'casper', '0x' + '01'.repeat(32));
const MESSAGE = {
  owner: '0x00' + '02'.repeat(32),
  spender: '0x01' + '03'.repeat(32),
  value: 1000n,
  nonce: 0n,
  deadline: 1999999999n,
};
const TYPED_DATA = { domain: DOMAIN, types: PermitTypes, primaryType: 'Permit', message: MESSAGE };
const EXPECTED_DIGEST = '0x545a8088d6365ada6ef282f4d5979c655cd428b4115cbf65f561bcd65767a98c';

describe('EIP712Repository', () => {
  const buildRepo = () => {
    const http = createMockHttpProvider();
    const accountInfoRepository = new AccountInfoRepository(http, CasperWalletApiByNetworkUrl);
    const contractPackageRepository = new ContractPackageRepository(
      http,
      CasperWalletApiByNetworkUrl,
    );
    const repo = new EIP712Repository(accountInfoRepository, contractPackageRepository);
    return { repo, http, accountInfoRepository, contractPackageRepository };
  };

  const repo = buildRepo().repo;

  it('computeDigest delegates to the digest util', () => {
    expect(repo.computeDigest(TYPED_DATA).digest).toBe(EXPECTED_DIGEST);
  });

  it('buildDisplayModel returns rows', () => {
    const model = repo.buildDisplayModel(TYPED_DATA);
    expect(model.primaryType).toBe('Permit');
    expect(model.messageRows).toHaveLength(5);
  });

  it('signDigest produces a 02-prefixed secp256k1 signature', () => {
    const key = PrivateKey.fromHex('11'.repeat(32), KeyAlgorithm.SECP256K1);
    const result = repo.signDigest({ privateKey: key, digest: EXPECTED_DIGEST });
    expect(result.signature.startsWith('02')).toBe(true);
    expect(result.digest).toBe(EXPECTED_DIGEST);
  });

  it('signTypedData computes then signs', () => {
    const key = PrivateKey.fromHex('11'.repeat(32), KeyAlgorithm.SECP256K1);
    const result = repo.signTypedData({ typedData: TYPED_DATA, privateKey: key });
    expect(result.digest).toBe(EXPECTED_DIGEST);
  });

  it('preserves an already-typed EIP712Error (pass-through)', () => {
    const broken = { ...TYPED_DATA, primaryType: 'Missing' };
    let caught: unknown;
    try {
      repo.computeDigest(broken);
    } catch (e) {
      caught = e;
    }
    expect(isEIP712Error(caught)).toBe(true);
  });

  it('wraps a non-EIP712 lib failure as EIP712Error with type computeDigest', () => {
    const malformed = { ...TYPED_DATA, message: { ...MESSAGE, owner: '0x1234' } };
    let caught: unknown;
    try {
      repo.computeDigest(malformed);
    } catch (e) {
      caught = e;
    }
    expect(isEIP712Error(caught)).toBe(true);
    expect((caught as EIP712Error).type).toBe('computeDigest');
  });

  const SIGNING_PK = '0106956df3aba7115e28271d053205ec7f33cab259f8e2da2f38150f0ece65a2a8';

  it('prepareSignatureRequest builds an enriched request', async () => {
    const { repo: r, accountInfoRepository, contractPackageRepository } = buildRepo();
    jest.spyOn(accountInfoRepository, 'getAccountsInfo').mockResolvedValue({});
    jest.spyOn(contractPackageRepository, 'getContractPackage').mockResolvedValue(null);

    const req = await r.prepareSignatureRequest({
      typedData: TYPED_DATA,
      signingPublicKeyHex: SIGNING_PK,
    });

    expect(req.digest).toBe(EXPECTED_DIGEST);
    expect(req.primaryType).toBe('Permit');
    expect(req.network).toBe('mainnet');
    expect(req.messageRows).toHaveLength(5);
  });

  it('still builds when enrichment lookups throw', async () => {
    const { repo: r, accountInfoRepository, contractPackageRepository } = buildRepo();
    jest.spyOn(accountInfoRepository, 'getAccountsInfo').mockRejectedValue(new Error('network'));
    jest.spyOn(contractPackageRepository, 'getContractPackage').mockRejectedValue(new Error('x'));

    const req = await r.prepareSignatureRequest({
      typedData: TYPED_DATA,
      signingPublicKeyHex: SIGNING_PK,
    });

    expect(req.digest).toBe(EXPECTED_DIGEST);
    expect(req.messageRows.every(row => row.accountInfo === null)).toBe(true);
    expect(req.domainRows.find(row => row.label === 'Package Hash')!.contractPackage).toBeNull();
  });

  it('skips lookups when the network is unmappable and none is provided', async () => {
    const { repo: r, accountInfoRepository } = buildRepo();
    const spy = jest.spyOn(accountInfoRepository, 'getAccountsInfo').mockResolvedValue({});
    const offNetwork = {
      ...TYPED_DATA,
      domain: { ...TYPED_DATA.domain, chain_name: 'unknown-chain' },
    };

    const req = await r.prepareSignatureRequest({
      typedData: offNetwork,
      signingPublicKeyHex: SIGNING_PK,
    });

    expect(spy).not.toHaveBeenCalled();
    expect(req.network).toBeNull();
  });

  it('rejects with EIP712Error for invalid typed data', async () => {
    const { repo: r } = buildRepo();
    let caught: unknown;
    try {
      await r.prepareSignatureRequest({
        typedData: { ...TYPED_DATA, primaryType: 'Missing' },
        signingPublicKeyHex: SIGNING_PK,
      });
    } catch (e) {
      caught = e;
    }
    expect(isEIP712Error(caught)).toBe(true);
  });
});
