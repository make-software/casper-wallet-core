import { EIP712SignatureRequestDto } from './EIP712SignatureRequestDto';

const OWNER = 'a'.repeat(64);
const PKG_HASH = '01'.repeat(32); // 64 hex chars, no 0x prefix (clean hash used in map key)
const SIGNING_PK = '0106956df3aba7115e28271d053205ec7f33cab259f8e2da2f38150f0ece65a2a8';

const typedData = {
  domain: { chain_name: 'casper', contract_package_hash: '0x' + PKG_HASH },
  types: {
    EIP712Domain: [
      { name: 'chain_name', type: 'string' },
      { name: 'contract_package_hash', type: 'bytes32' },
    ],
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
  },
  primaryType: 'Permit',
  // owner is an account-tagged address (0x00 prefix + 64-hex hash)
  message: { owner: '00' + OWNER, value: '1000' },
};

const ownerAccountInfo = {
  id: 'a',
  publicKey: '',
  accountHash: OWNER,
  name: 'Alice',
  brandingLogo: null,
  csprName: null,
  csprNameExpiresAt: null,
  explorerLink: null,
};

const contractPackage = {
  id: 'c',
  latestVersionContractTypeId: 1,
  contractPackageHash: PKG_HASH,
  name: 'MyToken',
  iconUrl: null,
  symbol: 'MTK',
  decimals: 9,
};

describe('EIP712SignatureRequestDto', () => {
  const dto = new EIP712SignatureRequestDto({
    typedData,
    signingPublicKeyHex: SIGNING_PK,
    network: 'mainnet',
    digest: '0xdigest',
    accountInfoMap: { [OWNER]: ownerAccountInfo },
    contractPackageMap: { [PKG_HASH]: contractPackage },
    enrichment: { accounts: 'ok', contractPackage: 'ok' },
  });

  it('enriches address rows with account info', () => {
    const ownerRow = dto.messageRows.find(r => r.label === 'Owner')!;
    expect(ownerRow.accountInfo).toEqual(ownerAccountInfo);
    // value should be the clean hash (tag stripped)
    expect(ownerRow.value).toBe(OWNER);
  });

  it('enriches the contract_package_hash row with the contract package', () => {
    expect(dto.domainRows.find(r => r.label === 'Package Hash')!.contractPackage).toEqual(
      contractPackage,
    );
  });

  it('carries scalar fields', () => {
    expect(dto.network).toBe('mainnet');
    expect(dto.chainName).toBe('casper');
    expect(dto.primaryType).toBe('Permit');
    expect(dto.digest).toBe('0xdigest');
    expect(dto.id).toBe('0xdigest');
    expect(dto.hashArtifacts).toBeUndefined();
  });

  it('forwards hashArtifacts when provided', () => {
    const artifacts = {
      domainTypeString: 'EIP712Domain(...)',
      domain: typedData.domain,
      domainSeparator: '0xsep',
      structHash: '0xstruct',
      canonicalTypeString: 'Permit(...)',
      typeHash: '0xtype',
    };
    const withArtifacts = new EIP712SignatureRequestDto({
      typedData,
      signingPublicKeyHex: SIGNING_PK,
      network: 'mainnet',
      digest: '0xdigest',
      hashArtifacts: artifacts,
      accountInfoMap: {},
      contractPackageMap: {},
      enrichment: { accounts: 'ok', contractPackage: 'absent' },
    });
    expect(withArtifacts.hashArtifacts).toEqual(artifacts);
  });

  it('falls back to the raw signing key when no account info is found', () => {
    expect(dto.signingKey).toBe(SIGNING_PK);
    expect(dto.signingKeyType).toBe('publicKey');
    expect(dto.signingAccountInfo).toBeNull();
  });

  it('serializes bigint message values in rawJson', () => {
    const bigintData = { ...typedData, message: { owner: '00' + OWNER, value: 1000n } };
    const d = new EIP712SignatureRequestDto({
      typedData: bigintData,
      signingPublicKeyHex: SIGNING_PK,
      network: 'mainnet',
      digest: '0xd',
      accountInfoMap: {},
      contractPackageMap: {},
      enrichment: { accounts: 'ok', contractPackage: 'absent' },
    });
    expect(JSON.parse(d.rawJson).message.value).toBe('1000');
  });

  it('carries the enrichment status', () => {
    expect(dto.enrichment).toEqual({ accounts: 'ok', contractPackage: 'ok' });
  });

  it('excludes chain_name from domainRows (surfaced as chainName instead)', () => {
    expect(dto.chainName).toBe('casper');
    expect(dto.domainRows.find(r => r.label === 'Chain Name')).toBeUndefined();
    expect(dto.domainRows.find(r => r.label === 'Package Hash')).toBeDefined();
  });

  it('handles a domain without chain_name', () => {
    const noChainName = {
      ...typedData,
      domain: { contract_package_hash: '0x' + PKG_HASH },
      types: {
        ...typedData.types,
        EIP712Domain: [{ name: 'contract_package_hash', type: 'bytes32' }],
      },
    };
    const d = new EIP712SignatureRequestDto({
      typedData: noChainName,
      signingPublicKeyHex: SIGNING_PK,
      network: 'mainnet',
      digest: '0xd',
      accountInfoMap: {},
      contractPackageMap: {},
      enrichment: { accounts: 'ok', contractPackage: 'absent' },
    });
    expect(d.chainName).toBe('');
    expect(d.domainRows.find(r => r.label === 'Chain Name')).toBeUndefined();
    expect(d.domainRows.find(r => r.label === 'Package Hash')).toBeDefined();
  });

  it('returns null contractPackage for a package hash not in the map', () => {
    const dto2 = new EIP712SignatureRequestDto({
      typedData,
      signingPublicKeyHex: SIGNING_PK,
      network: 'mainnet',
      digest: '0xd2',
      accountInfoMap: {},
      contractPackageMap: {}, // empty map — no package enrichment
      enrichment: { accounts: 'ok', contractPackage: 'absent' },
    });
    expect(dto2.domainRows.find(r => r.label === 'Package Hash')!.contractPackage).toBeNull();
  });
});
