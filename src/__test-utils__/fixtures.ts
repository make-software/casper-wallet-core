/**
 * Factory functions for building API/SDK response fixtures used across tests.
 *
 * Each builder returns a representative shape that downstream consumers (DTOs,
 * repositories, integration tests) can use without re-defining the same JSON
 * in every test file.
 */
import type { IAccountInfo, IDeploy } from '../domain';
import type {
  Erc20Token,
  IGetCsprBalanceResponse,
  IGetCurrencyRateResponse,
  IApiNft,
  IApiValidator,
  ExtendedCloudDeploy,
  IGetAccountsInfoResponse,
  IContractPackageCloudResponse,
  IMarketingEventApiResponse,
  IReleaseEventApiResponse,
} from '../data/repositories';

const PUBLIC_KEY = '0106956df3aba7115e28271d053205ec7f33cab259f8e2da2f38150f0ece65a2a8';
const ACCOUNT_HASH = 'a'.repeat(64);

export const makeFakePublicKey = (): string => PUBLIC_KEY;
export const makeFakeAccountHash = (): string => ACCOUNT_HASH;

export const makeErc20Token = (
  overrides: Partial<Erc20Token['contract_package']> = {},
): Erc20Token => ({
  balance: '10000000000', // raw, 10 token at 9 decimals
  contract_package_hash: 'cph_' + 'b'.repeat(60),
  owner_hash: ACCOUNT_HASH,
  owner_type: 1,
  contract_package: {
    description: null,
    name: 'Sample Token',
    contract_package_hash: 'cph_' + 'b'.repeat(60),
    contract_type_id: 2,
    icon_url: 'https://example.com/icon.png',
    metadata: {
      balances_uref: '',
      decimals: 9,
      name: 'Sample Token',
      symbol: 'STK',
      total_supply_uref: '',
    },
    owner_public_key: PUBLIC_KEY,
    timestamp: '2024-01-01T00:00:00.000Z',
    coingecko_id: null,
    friendlymarket_id: null,
    latest_version_contract_hash: null,
    token_market_data: null,
    ...overrides,
  } as Erc20Token['contract_package'],
});

export const makeCsprBalanceResponse = (
  overrides: Partial<IGetCsprBalanceResponse> = {},
): IGetCsprBalanceResponse => ({
  balance: '1000000000000', // 1000 CSPR (9 decimals)
  delegated_balance: 500_000_000_000,
  undelegating_balance: 0,
  public_key: PUBLIC_KEY,
  account_hash: ACCOUNT_HASH,
  main_purse_uref: 'uref-' + 'c'.repeat(60),
  ...overrides,
});

export const makeCurrencyRateResponse = (amount = 0.05): IGetCurrencyRateResponse => ({
  data: {
    currency_id: 1,
    amount,
    created: '2024-01-01T00:00:00.000Z',
  },
});

export const makeAccountsInfoResponse = (
  overrides: Partial<IGetAccountsInfoResponse> = {},
): IGetAccountsInfoResponse =>
  ({
    public_key: PUBLIC_KEY,
    account_hash: ACCOUNT_HASH,
    cspr_name: 'alice.cspr',
    account_info: {
      info: {
        owner: {
          name: 'Alice',
          branding: { logo: { png_256: 'https://example.com/logo.png' } },
        },
      },
    },
    centralized_account_info: null,
    ...overrides,
  }) as unknown as IGetAccountsInfoResponse;

export const makeApiNft = (overrides: Partial<IApiNft> = {}): IApiNft =>
  ({
    token_id: '1',
    contract_package_hash: 'cph_' + 'd'.repeat(60),
    token_standard_id: 2,
    tracking_id: 'track-1',
    timestamp: '2024-01-01T00:00:00.000Z',
    onchain_metadata: { name: 'Cool NFT', image: 'https://example.com/nft.png' },
    offchain_metadata: { description: 'A cool NFT' },
    contract_package: {
      name: 'Cool Collection',
      icon_url: 'https://example.com/coll.png',
      metadata: { identifier_mode: 0, owner_reverse_lookup_mode: 1 },
    },
    ...overrides,
  }) as unknown as IApiNft;

export const makeApiValidator = (overrides: Partial<IApiValidator> = {}): IApiValidator =>
  ({
    public_key: PUBLIC_KEY,
    delegators_number: 25,
    total_stake: '50000000000000', // 50_000 CSPR
    fee: '1000',
    minimum_delegation_amount: '500000000000',
    maximum_delegation_amount: undefined,
    reserved_slots: 0,
    network_share: '3.25',
    account_info: {
      info: { owner: { name: 'ValidatorOne' } },
    },
    ...overrides,
  }) as unknown as IApiValidator;

export const makeContractPackageResponse = (
  overrides: Partial<IContractPackageCloudResponse> = {},
): IContractPackageCloudResponse =>
  ({
    contract_package_hash: 'cph_' + 'e'.repeat(60),
    name: 'Sample Package',
    icon_url: 'https://example.com/pkg.png',
    metadata: { decimals: 18, symbol: 'PKG' },
    latest_version_contract_type_id: 2,
    ...overrides,
  }) as unknown as IContractPackageCloudResponse;

export const makeMarketingEvent = (
  overrides: Partial<IMarketingEventApiResponse> = {},
): IMarketingEventApiResponse =>
  ({
    id: 42,
    name: 'Promo',
    description: 'A promo event',
    start_at: '2024-01-01T00:00:00.000Z',
    end_at: '2099-01-01T00:00:00.000Z',
    url: 'https://example.com/promo',
    image_url: null,
    ...overrides,
  }) as unknown as IMarketingEventApiResponse;

export const makeReleaseEvent = (
  overrides: Partial<IReleaseEventApiResponse> = {},
): IReleaseEventApiResponse =>
  ({
    breaking: false,
    release_notes: ['First release'],
    released: true,
    version: '1.2.0',
    ...overrides,
  }) as unknown as IReleaseEventApiResponse;

export const makeAccountInfo = (overrides: Partial<IAccountInfo> = {}): IAccountInfo => ({
  id: PUBLIC_KEY,
  publicKey: PUBLIC_KEY,
  accountHash: ACCOUNT_HASH,
  name: 'Alice',
  brandingLogo: null,
  csprName: null,
  explorerLink: null,
  ...overrides,
});

export const makeCloudDeploy = (
  overrides: Partial<ExtendedCloudDeploy> = {},
): ExtendedCloudDeploy =>
  ({
    deploy_hash: 'd'.repeat(64),
    caller_public_key: PUBLIC_KEY,
    caller_account_hash: ACCOUNT_HASH,
    timestamp: '2024-01-01T00:00:00.000Z',
    error_message: null,
    status: 'processed',
    cost: '1000000000',
    payment_amount: '1000000000',
    block_hash: 'b'.repeat(64),
    execution_type_id: 6,
    contract_hash: null,
    contract_package_hash: null,
    contract_type_id: null,
    entry_point_id: null,
    contract_package: null,
    contract_entrypoint: null,
    transfers: [],
    nft_token_actions: [],
    ft_token_actions: [],
    rate: 0.05,
    account_info: null,
    centralized_account_info: null,
    ...overrides,
  }) as unknown as ExtendedCloudDeploy;

export const makeUnknownDeploy = (overrides: Partial<IDeploy> = {}): IDeploy =>
  ({
    id: 'deploy-1',
    type: 'UNKNOWN',
    deployHash: 'd'.repeat(64),
    callerPublicKey: PUBLIC_KEY,
    callerAccountHash: ACCOUNT_HASH,
    timestamp: '2024-01-01T00:00:00.000Z',
    cost: '1000000000',
    formattedCost: '1',
    fiatCost: '0',
    formattedFiatCost: '$0.00',
    network: 'mainnet',
    status: 'success',
    executionTypeId: 1,
    isReceive: false,
    ...overrides,
  }) as unknown as IDeploy;
