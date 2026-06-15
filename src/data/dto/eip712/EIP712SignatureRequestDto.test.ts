import { EIP712SignatureRequestDto } from './EIP712SignatureRequestDto';

const OWNER = 'a'.repeat(64);
const PKG_HASH = '0x' + '01'.repeat(32);
const SIGNING_PK = '0106956df3aba7115e28271d053205ec7f33cab259f8e2da2f38150f0ece65a2a8';

const typedData = {
  domain: { chain_name: 'casper', contract_package_hash: PKG_HASH },
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
  message: { owner: OWNER, value: '1000' },
};

const ownerAccountInfo = {
  id: 'a',
  publicKey: '',
  accountHash: OWNER,
  name: 'Alice',
  brandingLogo: null,
  csprName: null,
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
    contractPackage,
    enrichment: { accounts: 'ok', contractPackage: 'ok' },
  });

  it('enriches address rows with account info', () => {
    expect(dto.messageRows.find(r => r.label === 'Owner')!.accountInfo).toEqual(ownerAccountInfo);
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
    expect(JSON.parse(dto.rawJson)).toEqual(typedData);
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
      contractPackage: null,
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
    const bigintData = { ...typedData, message: { owner: OWNER, value: 1000n } };
    const d = new EIP712SignatureRequestDto({
      typedData: bigintData,
      signingPublicKeyHex: SIGNING_PK,
      network: 'mainnet',
      digest: '0xd',
      accountInfoMap: {},
      contractPackage: null,
      enrichment: { accounts: 'ok', contractPackage: 'absent' },
    });
    expect(JSON.parse(d.rawJson).message.value).toBe('1000');
  });

  it('carries the enrichment status', () => {
    expect(dto.enrichment).toEqual({ accounts: 'ok', contractPackage: 'ok' });
  });
});
