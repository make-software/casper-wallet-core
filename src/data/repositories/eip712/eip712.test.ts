import { PrivateKey, KeyAlgorithm } from 'casper-js-sdk';
import { fromHex } from '@casper-ecosystem/casper-eip-712';
import { PermitTypes, buildDomain } from '@casper-ecosystem/casper-eip-712';
import { EIP712Repository } from './index';
import { AccountInfoRepository } from '../accountInfo';
import { ContractPackageRepository } from '../contractPackage';
import { createMockHttpProvider } from '../../../__test-utils__';
import {
  CasperWalletApiByNetworkUrl,
  EIP712Error,
  ILogger,
  isEIP712Error,
  SignTypedDataErrorCodes,
} from '../../../domain';
import { getAccountHashFromPublicKey } from '../../../utils';
import * as digestModule from '../../../utils/eip712/digest';
import * as validationModule from '../../../utils/eip712/validation';
import { getTypedDataEIP712Leaves } from '../../../utils/eip712/walk';
import {
  PERMIT2_PRIMARY_TYPES,
  buildPermit2TypedData,
  Permit2PrimaryType,
} from '../../../__test-utils__/permit2';

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

// Source: csprclick-x402-permite2 demo, src/Permit2.tsx (inner `typedData` of each export).
const DEMO_PERMIT_TRANSFER_FROM = {
  types: {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chain_name', type: 'string' },
      { name: 'contract_package_hash', type: 'bytes32' },
    ],
    PermitTransferFrom: [
      { name: 'permitted', type: 'TokenPermissions' },
      { name: 'spender', type: 'address' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
    TokenPermissions: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
  },
  primaryType: 'PermitTransferFrom',
  domain: {
    name: 'Permit2',
    version: '1',
    chain_name: 'casper:casper-test',
    contract_package_hash: '8058e3c16943bd9eadefbd2b4d4fb1e32ce118e492e179c42e14ed3f71d5601d',
  },
  message: {
    permitted: {
      token: '013d80df21ba4ee4d66a2a1f60c32570dd5685e4b279f6538162a5fd1314847c1e',
      amount: '00000000000000000000000000000000000000000000000000000000000003e8',
    },
    spender: '0081d557c9dcaadea97c34d79bf7b6af07aa9d760e5dd1aabf78a45fb39e072c3a',
    nonce: '5e38ac48c5f84e841a8b87d06afc49adb9aa117f1eb4dd4c797bf1c0d3a032be',
    deadline: '000000000000000000000000000000000000000000000000000000006ae85b80',
  },
};

// Source: csprclick-x402-permite2 demo, src/Permit2.tsx (inner `typedData` of each export).
const DEMO_PERMIT_SINGLE = {
  types: {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chain_name', type: 'string' },
      { name: 'contract_package_hash', type: 'bytes32' },
    ],
    PermitSingle: [
      { name: 'details', type: 'PermitDetails' },
      { name: 'spender', type: 'address' },
      { name: 'sigDeadline', type: 'uint256' },
    ],
    PermitDetails: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'expiration', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
    ],
  },
  primaryType: 'PermitSingle',
  domain: {
    name: 'Permit2',
    version: '1',
    chain_name: 'casper:casper-test',
    contract_package_hash: '8058e3c16943bd9eadefbd2b4d4fb1e32ce118e492e179c42e14ed3f71d5601d',
  },
  message: {
    details: {
      token: '013d80df21ba4ee4d66a2a1f60c32570dd5685e4b279f6538162a5fd1314847c1e',
      amount: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      expiration: '000000000000000000000000000000000000000000000000000000006ae9a49a',
      nonce: '0000000000000000000000000000000000000000000000000000000000000001',
    },
    spender: '0081d557c9dcaadea97c34d79bf7b6af07aa9d760e5dd1aabf78a45fb39e072c3a',
    sigDeadline: '000000000000000000000000000000000000000000000000000000006ae8612a',
  },
};

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

  it('buildDisplayModel rejects typed data the digest would reject', () => {
    const bad = { ...TYPED_DATA, message: { ...MESSAGE, value: 'abc' } };
    expect(() => repo.buildDisplayModel(bad)).toThrow(
      expect.objectContaining({ errorCode: 'INVALID_PARAMS' }),
    );
  });

  it('wraps a non-EIP712 validation failure in buildDisplayModel as EIP712Error', () => {
    const spy = jest.spyOn(validationModule, 'validateTypedDataEIP712').mockImplementation(() => {
      throw new Error('boom');
    });
    let caught: unknown;
    try {
      repo.buildDisplayModel(TYPED_DATA);
    } catch (e) {
      caught = e;
    } finally {
      spy.mockRestore();
    }
    expect(isEIP712Error(caught)).toBe(true);
    expect((caught as EIP712Error).type).toBe('validateTypedDataEIP712');
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

  it('surfaces a malformed address as a validation EIP712Error', () => {
    const malformed = { ...TYPED_DATA, message: { ...MESSAGE, owner: '0x1234' } };
    let caught: unknown;
    try {
      repo.computeDigest(malformed);
    } catch (e) {
      caught = e;
    }
    expect(isEIP712Error(caught)).toBe(true);
    expect((caught as EIP712Error).type).toBe('validateTypedDataEIP712');
    expect((caught as EIP712Error).errorCode).toBe(SignTypedDataErrorCodes.INVALID_PARAMS);
  });

  it('wraps a non-EIP712 digest failure as EIP712Error with type computeDigest', () => {
    const spy = jest.spyOn(digestModule, 'computeTypedDataEIP712Digest').mockImplementation(() => {
      throw new Error('boom');
    });
    let caught: unknown;
    try {
      repo.computeDigest(TYPED_DATA);
    } catch (e) {
      caught = e;
    } finally {
      spy.mockRestore();
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
    hasDecimals: true,
  };

  it('prepareSignatureRequest builds an enriched request', async () => {
    const { repo: r, accountInfoRepository, contractPackageRepository } = buildRepo();
    jest.spyOn(accountInfoRepository, 'getAccountsInfo').mockResolvedValue({});
    jest.spyOn(contractPackageRepository, 'getContractPackage').mockResolvedValue(pkg);

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

  it('reports contractPackage as failed when no lookup returns data', async () => {
    const { repo: r, accountInfoRepository, contractPackageRepository } = buildRepo();
    jest.spyOn(accountInfoRepository, 'getAccountsInfo').mockResolvedValue({});
    jest.spyOn(contractPackageRepository, 'getContractPackage').mockResolvedValue(null);

    const req = await r.prepareSignatureRequest({
      typedData: TYPED_DATA,
      signingPublicKeyHex: SIGNING_PK,
    });

    expect(req.enrichment).toEqual({ accounts: 'ok', contractPackage: 'failed' });
  });

  it('reports contractPackage as partial when some lookups return no data', async () => {
    const { repo: r, accountInfoRepository, contractPackageRepository } = buildRepo();
    jest.spyOn(accountInfoRepository, 'getAccountsInfo').mockResolvedValue({});
    jest
      .spyOn(contractPackageRepository, 'getContractPackage')
      .mockImplementation(async ({ contractPackageHash }) =>
        contractPackageHash === pkg.contractPackageHash ? pkg : null,
      );

    const req = await r.prepareSignatureRequest({
      typedData: TYPED_DATA,
      signingPublicKeyHex: SIGNING_PK,
    });

    expect(req.enrichment.contractPackage).toBe('partial');
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

  it('rejects an unmappable chain_name before any lookup', async () => {
    const { repo: r, accountInfoRepository, contractPackageRepository } = buildRepo();
    const spy = jest.spyOn(accountInfoRepository, 'getAccountsInfo').mockResolvedValue({});
    const pkgSpy = jest
      .spyOn(contractPackageRepository, 'getContractPackage')
      .mockResolvedValue(null);
    const offNetwork = {
      ...TYPED_DATA,
      domain: { ...TYPED_DATA.domain, chain_name: 'unknown-chain' },
    };

    await expect(
      r.prepareSignatureRequest({
        typedData: offNetwork,
        signingPublicKeyHex: SIGNING_PK,
        network: 'testnet',
      }),
    ).rejects.toMatchObject({ errorCode: 'INVALID_PARAMS' });
    expect(spy).not.toHaveBeenCalled();
    expect(pkgSpy).not.toHaveBeenCalled();
  });

  it('rejects a domain without contract_package_hash before any lookup', async () => {
    const { repo: r, accountInfoRepository, contractPackageRepository } = buildRepo();
    const spy = jest.spyOn(accountInfoRepository, 'getAccountsInfo').mockResolvedValue({});
    const pkgSpy = jest
      .spyOn(contractPackageRepository, 'getContractPackage')
      .mockResolvedValue(null);
    const partial = Object.fromEntries(
      Object.entries(TYPED_DATA.domain).filter(([k]) => k !== 'contract_package_hash'),
    );

    await expect(
      r.prepareSignatureRequest({
        typedData: { ...TYPED_DATA, domain: partial },
        signingPublicKeyHex: SIGNING_PK,
      }),
    ).rejects.toMatchObject({ errorCode: 'INVALID_PARAMS' });
    expect(spy).not.toHaveBeenCalled();
    expect(pkgSpy).not.toHaveBeenCalled();
  });

  it('rejects a chain_name that only ends in a known one before any lookup', async () => {
    const { repo: r, accountInfoRepository } = buildRepo();
    const spy = jest.spyOn(accountInfoRepository, 'getAccountsInfo').mockResolvedValue({});

    await expect(
      r.prepareSignatureRequest({
        typedData: { ...TYPED_DATA, domain: { ...TYPED_DATA.domain, chain_name: 'evil:casper' } },
        signingPublicKeyHex: SIGNING_PK,
      }),
    ).rejects.toMatchObject({ errorCode: 'INVALID_PARAMS' });
    expect(spy).not.toHaveBeenCalled();
  });

  it.each(['casper-test', 'casper:casper-test'])(
    'maps chain_name %p to the testnet network for the request and both lookups',
    async chainName => {
      const { repo: r, accountInfoRepository, contractPackageRepository } = buildRepo();
      const spy = jest.spyOn(accountInfoRepository, 'getAccountsInfo').mockResolvedValue({});
      const pkgSpy = jest
        .spyOn(contractPackageRepository, 'getContractPackage')
        .mockResolvedValue(null);
      const testnet = { ...TYPED_DATA, domain: { ...TYPED_DATA.domain, chain_name: chainName } };

      const req = await r.prepareSignatureRequest({
        typedData: testnet,
        signingPublicKeyHex: SIGNING_PK,
      });
      expect(req.network).toBe('testnet');
      expect(spy.mock.calls[0][0].network).toBe('testnet');
      expect(pkgSpy).toHaveBeenCalledTimes(2);
      pkgSpy.mock.calls.forEach(([arg]) => expect(arg.network).toBe('testnet'));
    },
  );

  it('prefers a mappable chain_name over the network param', async () => {
    const { repo: r, accountInfoRepository, contractPackageRepository } = buildRepo();
    const spy = jest.spyOn(accountInfoRepository, 'getAccountsInfo').mockResolvedValue({});
    const pkgSpy = jest
      .spyOn(contractPackageRepository, 'getContractPackage')
      .mockResolvedValue(null);

    const req = await r.prepareSignatureRequest({
      typedData: TYPED_DATA, // chain_name 'casper' → mainnet
      signingPublicKeyHex: SIGNING_PK,
      network: 'testnet',
    });

    expect(req.network).toBe('mainnet');
    expect(spy.mock.calls[0][0].network).toBe('mainnet');
    expect(pkgSpy).toHaveBeenCalledTimes(2);
    pkgSpy.mock.calls.forEach(([arg]) => expect(arg.network).toBe('mainnet'));
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

  describe('Permit2 typed data', () => {
    const cep18Package = {
      ...pkg,
      latestVersionContractTypeId: 2,
      name: 'Wrapped CSPR',
      symbol: 'WCSPR',
      decimals: 9,
      hasDecimals: true,
    };

    const prepare = (
      primaryType: Permit2PrimaryType,
      getContractPackage: (hash: string) => Promise<typeof cep18Package | null> = async () =>
        cep18Package,
    ) => {
      const { repo: r, accountInfoRepository, contractPackageRepository } = buildRepo();
      jest.spyOn(accountInfoRepository, 'getAccountsInfo').mockResolvedValue({});
      jest
        .spyOn(contractPackageRepository, 'getContractPackage')
        .mockImplementation(({ contractPackageHash }) => getContractPackage(contractPackageHash));
      const typedData = buildPermit2TypedData(primaryType, undefined, 33);
      return {
        typedData,
        request: r.prepareSignatureRequest({ typedData, signingPublicKeyHex: SIGNING_PK }),
      };
    };

    const prepareDemo = (
      typedData: typeof DEMO_PERMIT_TRANSFER_FROM | typeof DEMO_PERMIT_SINGLE,
    ) => {
      const { repo: r, accountInfoRepository, contractPackageRepository } = buildRepo();
      jest.spyOn(accountInfoRepository, 'getAccountsInfo').mockResolvedValue({});
      jest.spyOn(contractPackageRepository, 'getContractPackage').mockResolvedValue(cep18Package);
      return r.prepareSignatureRequest({ typedData, signingPublicKeyHex: SIGNING_PK });
    };

    it.each(PERMIT2_PRIMARY_TYPES)(
      'prepares %s with one row per leaf and a digest equal to computeDigest',
      async primaryType => {
        const { typedData, request } = prepare(primaryType);
        const req = await request;

        const leafCount = getTypedDataEIP712Leaves(
          primaryType,
          typedData.types,
          typedData.message,
        ).length;
        expect(req.digest).toBe(repo.computeDigest(typedData).digest);
        expect(req.primaryType).toBe(primaryType);
        expect(req.messageRows).toHaveLength(leafCount);
        req.messageRows.forEach(row => {
          expect(row.value).not.toContain('[object Object]');
          expect(row.displayValue).not.toContain('[object Object]');
        });
      },
    );

    it('shows a CEP-18 amount in token units with the symbol', async () => {
      const req = await prepare('PermitTransferFrom').request;

      const row = req.messageRows.find(r => r.label === 'Permitted › Amount')!;
      expect(row.value).toBe('1000');
      expect(row.displayValue).toBe('0.000001 WCSPR');
      expect(row.token).toEqual({
        contractPackageHash: '01'.repeat(32),
        symbol: 'WCSPR',
        decimals: 9,
      });
    });

    it('reports contractPackage as partial and keeps the raw amount when a token lookup throws', async () => {
      const req = await prepare('PermitTransferFrom', async hash => {
        if (hash === '01'.repeat(32)) {
          throw new Error('pkg');
        }
        return cep18Package;
      }).request;

      expect(req.enrichment.contractPackage).toBe('partial');
      const row = req.messageRows.find(r => r.label === 'Permitted › Amount')!;
      expect(row.displayValue).toBe('1000');
      expect(row.token).toBeNull();
    });

    it('prepares the demo PermitTransferFrom as sent', async () => {
      const req = await prepareDemo(DEMO_PERMIT_TRANSFER_FROM);

      const row = (label: string) => req.messageRows.find(r => r.label === label)!;
      expect(row('Permitted › Amount').value).toBe('1000');
      expect(row('Nonce').value).toBe(
        BigInt('0x5e38ac48c5f84e841a8b87d06afc49adb9aa117f1eb4dd4c797bf1c0d3a032be').toString(),
      );
      expect(row('Deadline').presentation).toBe('date');
    });

    it('prepares the demo PermitSingle as sent', async () => {
      const req = await prepareDemo(DEMO_PERMIT_SINGLE);

      const row = (label: string) => req.messageRows.find(r => r.label === label)!;
      expect(row('Details › Amount').displayValue).toBe('Unlimited WCSPR');
      expect(row('Details › Expiration').presentation).toBe('date');
      expect(row('Sig Deadline').presentation).toBe('date');
      expect(row('Details › Nonce').value).toBe('1');
    });

    it('gives the demo PermitTransferFrom the same digest with 0x-prefixed numbers', async () => {
      const { message } = DEMO_PERMIT_TRANSFER_FROM;
      const prefixed = {
        ...DEMO_PERMIT_TRANSFER_FROM,
        message: {
          ...message,
          permitted: { ...message.permitted, amount: '0x' + message.permitted.amount },
          nonce: '0x' + message.nonce,
          deadline: '0x' + message.deadline,
        },
      };

      const [verbatim, withPrefix] = await Promise.all([
        prepareDemo(DEMO_PERMIT_TRANSFER_FROM),
        prepareDemo(prefixed),
      ]);

      expect(withPrefix.digest).toBe(verbatim.digest);
    });

    it('signs PermitBatch and the signature verifies against the digest', () => {
      const typedData = buildPermit2TypedData('PermitBatch', undefined, 33);
      const key = PrivateKey.fromHex('11'.repeat(32), KeyAlgorithm.SECP256K1);

      const result = repo.signTypedData({ typedData, privateKey: key });

      expect(result.digest).toBe(repo.computeDigest(typedData).digest);
      const signature = Uint8Array.from(Buffer.from(result.signature, 'hex'));
      expect(key.publicKey.verifySignature(fromHex(result.digest), signature)).toBe(true);
    });
  });
});
