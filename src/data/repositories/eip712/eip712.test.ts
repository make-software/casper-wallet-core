import { PrivateKey, KeyAlgorithm } from 'casper-js-sdk';
import { PermitTypes, buildDomain } from '@casper-ecosystem/casper-eip-712';
import { EIP712Repository } from './index';
import { AccountInfoRepository } from '../accountInfo';
import { ContractPackageRepository } from '../contractPackage';
import { createMockHttpProvider } from '../../../__test-utils__';
import { CasperWalletApiByNetworkUrl, EIP712Error, ILogger, isEIP712Error } from '../../../domain';
import { getAccountHashFromPublicKey } from '../../../utils';

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
    const logger: ILogger = {
      log: jest.fn(),
      logGroup: jest.fn(),
      logGroupEnd: jest.fn(),
      reportError: jest.fn(),
    };
    const repo = new EIP712Repository(accountInfoRepository, contractPackageRepository, logger);
    return { repo, http, accountInfoRepository, contractPackageRepository, logger };
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

  const accountInfo = {
    id: 'sk',
    publicKey: SIGNING_PK,
    accountHash: getAccountHashFromPublicKey(SIGNING_PK),
    name: 'Signer',
    brandingLogo: null,
    csprName: null,
    csprNameExpiresAt: null,
    explorerLink: null,
  };
  const pkg = {
    id: 'c',
    latestVersionContractTypeId: 1,
    contractPackageHash: '01'.repeat(32),
    name: 'Token',
    iconUrl: null,
    symbol: 'TKN',
    decimals: 9,
  };

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
    expect(req.enrichment).toEqual({ accounts: 'ok', contractPackage: 'ok' });
  });

  it('calls getContractPackage once per unique package hash', async () => {
    const { repo: r, accountInfoRepository, contractPackageRepository } = buildRepo();
    jest.spyOn(accountInfoRepository, 'getAccountsInfo').mockResolvedValue({});
    const pkgSpy = jest
      .spyOn(contractPackageRepository, 'getContractPackage')
      .mockResolvedValue(null);

    // TYPED_DATA has domain contract_package_hash ('01'.repeat(32))
    // and a package-tagged spender ('0x01' + '03'.repeat(32))
    // so 2 unique package hashes → 2 calls
    await r.prepareSignatureRequest({ typedData: TYPED_DATA, signingPublicKeyHex: SIGNING_PK });

    expect(pkgSpy).toHaveBeenCalledTimes(2);
    expect(pkgSpy).toHaveBeenCalledWith(
      expect.objectContaining({ contractPackageHash: '01'.repeat(32) }),
    );
    expect(pkgSpy).toHaveBeenCalledWith(
      expect.objectContaining({ contractPackageHash: '03'.repeat(32) }),
    );
  });

  it('calls the lookups with deduped hashes, mapped network, proxy flag and 0x-stripped hash', async () => {
    const { repo: r, accountInfoRepository, contractPackageRepository } = buildRepo();
    const accountsSpy = jest.spyOn(accountInfoRepository, 'getAccountsInfo').mockResolvedValue({});
    const pkgSpy = jest
      .spyOn(contractPackageRepository, 'getContractPackage')
      .mockResolvedValue(null);

    await r.prepareSignatureRequest({ typedData: TYPED_DATA, signingPublicKeyHex: SIGNING_PK });

    const accountsArg = accountsSpy.mock.calls[0][0];
    expect(accountsArg.network).toBe('mainnet');
    expect(accountsArg.withProxyHeader).toBe(true);
    expect(accountsArg.accountHashes).toContain(getAccountHashFromPublicKey(SIGNING_PK));
    expect(new Set(accountsArg.accountHashes).size).toBe(accountsArg.accountHashes.length);

    // Domain package hash should be called with 0x stripped
    expect(pkgSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        contractPackageHash: '01'.repeat(32), // 0x stripped
        network: 'mainnet',
        withProxyHeader: true,
      }),
    );
  });

  it('feeds a non-empty account map through to the DTO (repo→DTO keying)', async () => {
    const { repo: r, accountInfoRepository, contractPackageRepository } = buildRepo();
    jest
      .spyOn(accountInfoRepository, 'getAccountsInfo')
      .mockResolvedValue({ [accountInfo.accountHash]: accountInfo });
    jest.spyOn(contractPackageRepository, 'getContractPackage').mockResolvedValue(null);

    const req = await r.prepareSignatureRequest({
      typedData: TYPED_DATA,
      signingPublicKeyHex: SIGNING_PK,
    });

    expect(req.signingAccountInfo).toEqual(accountInfo);
  });

  it('falls back to the LRU cache and logs when getAccountsInfo throws', async () => {
    const { repo: r, accountInfoRepository, contractPackageRepository, logger } = buildRepo();
    const err = new Error('network');
    jest.spyOn(accountInfoRepository, 'getAccountsInfo').mockRejectedValue(err);
    jest.spyOn(contractPackageRepository, 'getContractPackage').mockResolvedValue(pkg);
    jest
      .spyOn(accountInfoRepository, 'accountsInfoMapCache', 'get')
      .mockReturnValue({ [accountInfo.accountHash]: accountInfo });

    const req = await r.prepareSignatureRequest({
      typedData: TYPED_DATA,
      signingPublicKeyHex: SIGNING_PK,
    });

    // independent: accounts failed but the contract package still resolved
    expect(req.enrichment).toEqual({ accounts: 'failed', contractPackage: 'ok' });
    expect(req.signingAccountInfo).toEqual(accountInfo); // came from the warm cache
    expect(req.domainRows.find(row => row.label === 'Package Hash')!.contractPackage).toEqual(pkg);
    expect(logger.reportError).toHaveBeenCalledWith(
      err,
      expect.stringContaining('getAccountsInfo'),
    );
  });

  it('keeps accounts when only getContractPackage throws (independent catches)', async () => {
    const { repo: r, accountInfoRepository, contractPackageRepository, logger } = buildRepo();
    const err = new Error('pkg');
    jest.spyOn(accountInfoRepository, 'getAccountsInfo').mockResolvedValue({});
    jest.spyOn(contractPackageRepository, 'getContractPackage').mockRejectedValue(err);

    const req = await r.prepareSignatureRequest({
      typedData: TYPED_DATA,
      signingPublicKeyHex: SIGNING_PK,
    });

    expect(req.enrichment).toEqual({ accounts: 'ok', contractPackage: 'failed' });
    expect(req.domainRows.find(row => row.label === 'Package Hash')!.contractPackage).toBeNull();
    expect(logger.reportError).toHaveBeenCalledWith(
      err,
      expect.stringContaining('getContractPackage'),
    );
  });

  it('reports contractPackage as partial when some lookups succeed and others throw', async () => {
    const { repo: r, accountInfoRepository, contractPackageRepository, logger } = buildRepo();
    const err = new Error('pkg');
    jest.spyOn(accountInfoRepository, 'getAccountsInfo').mockResolvedValue({});
    // Two unique package hashes: domain ('01'…) resolves, message-tagged ('03'…) throws.
    jest
      .spyOn(contractPackageRepository, 'getContractPackage')
      .mockImplementation(async ({ contractPackageHash }) => {
        if (contractPackageHash === '03'.repeat(32)) {
          throw err;
        }
        return pkg;
      });

    const req = await r.prepareSignatureRequest({
      typedData: TYPED_DATA,
      signingPublicKeyHex: SIGNING_PK,
    });

    expect(req.enrichment).toEqual({ accounts: 'ok', contractPackage: 'partial' });
    // The resolved package is still mapped; the failed one is silently absent.
    expect(req.domainRows.find(row => row.label === 'Package Hash')!.contractPackage).toEqual(pkg);
    expect(logger.reportError).toHaveBeenCalledWith(
      err,
      expect.stringContaining('getContractPackage'),
    );
  });

  it('skips lookups when the network is unmappable and none is provided', async () => {
    const { repo: r, accountInfoRepository, contractPackageRepository } = buildRepo();
    const spy = jest.spyOn(accountInfoRepository, 'getAccountsInfo').mockResolvedValue({});
    const pkgSpy = jest
      .spyOn(contractPackageRepository, 'getContractPackage')
      .mockResolvedValue(null);
    const offNetwork = {
      ...TYPED_DATA,
      domain: { ...TYPED_DATA.domain, chain_name: 'unknown-chain' },
    };

    const req = await r.prepareSignatureRequest({
      typedData: offNetwork,
      signingPublicKeyHex: SIGNING_PK,
    });

    expect(spy).not.toHaveBeenCalled();
    expect(pkgSpy).not.toHaveBeenCalled();
    expect(req.network).toBeNull();
    expect(req.enrichment).toEqual({ accounts: 'skipped', contractPackage: 'skipped' });
  });

  it('falls back to the network param when chain_name is unmappable', async () => {
    const { repo: r, accountInfoRepository, contractPackageRepository } = buildRepo();
    const spy = jest.spyOn(accountInfoRepository, 'getAccountsInfo').mockResolvedValue({});
    jest.spyOn(contractPackageRepository, 'getContractPackage').mockResolvedValue(null);
    const offNetwork = {
      ...TYPED_DATA,
      domain: { ...TYPED_DATA.domain, chain_name: 'unknown-chain' },
    };

    const req = await r.prepareSignatureRequest({
      typedData: offNetwork,
      signingPublicKeyHex: SIGNING_PK,
      network: 'testnet',
    });

    expect(req.network).toBe('testnet');
    expect(spy.mock.calls[0][0].network).toBe('testnet');
  });

  it('prefers a mappable chain_name over the network param', async () => {
    const { repo: r, accountInfoRepository, contractPackageRepository } = buildRepo();
    jest.spyOn(accountInfoRepository, 'getAccountsInfo').mockResolvedValue({});
    jest.spyOn(contractPackageRepository, 'getContractPackage').mockResolvedValue(null);

    const req = await r.prepareSignatureRequest({
      typedData: TYPED_DATA, // chain_name 'casper' → mainnet
      signingPublicKeyHex: SIGNING_PK,
      network: 'testnet',
    });

    expect(req.network).toBe('mainnet');
  });

  it('marks contractPackage absent when there are no package hashes at all', async () => {
    const { repo: r, accountInfoRepository, contractPackageRepository } = buildRepo();
    jest.spyOn(accountInfoRepository, 'getAccountsInfo').mockResolvedValue({});
    const pkgSpy = jest.spyOn(contractPackageRepository, 'getContractPackage');
    const noPkg = {
      domain: { name: 'CasperSwap', version: '1', chain_name: 'casper' },
      types: PermitTypes,
      primaryType: 'Permit',
      // MESSAGE has a package-tagged spender ('0x01' + '03'.repeat(32)) —
      // use a message with no package addresses and no domain package hash
      message: {
        owner: '0x00' + '02'.repeat(32),
        spender: '0x00' + '04'.repeat(32), // account-tagged, not package
        value: 1000n,
        nonce: 0n,
        deadline: 1999999999n,
      },
    };

    const req = await r.prepareSignatureRequest({
      typedData: noPkg,
      signingPublicKeyHex: SIGNING_PK,
    });

    expect(pkgSpy).not.toHaveBeenCalled();
    expect(req.enrichment.contractPackage).toBe('absent');
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
