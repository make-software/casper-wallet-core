import { CasperNetwork, Network } from '../common';
import { ICsprBalance, IToken, NftStandard } from '../../domain';

export const CSPR_DECIMALS = 9;

export const CasperLiveUrl: Record<CasperNetwork, string> = {
  mainnet: 'https://cspr.live',
  testnet: 'https://testnet.cspr.live',
};

/** @deprecated should be replaced with {CasperWalletApiUrl}  */
export const CasperApiUrl: Record<CasperNetwork, string> = {
  mainnet: 'https://event-store-api-clarity-mainnet.make.services',
  testnet: 'https://event-store-api-clarity-testnet.make.services',
};

export const CasperWalletApiUrl: Record<CasperNetwork, string> = {
  mainnet: 'https://api.mainnet.casperwallet.io',
  testnet: 'https://api.testnet.casperwallet.io',
};

export const OnRampApiUrl = 'https://onramp-api.cspr.click/api';

export const GrpcUrl: Record<CasperNetwork, string> = {
  mainnet: 'https://node.cspr.cloud/rpc',
  testnet: 'https://node.testnet.cspr.cloud/rpc',
};

export const CasperSdkNetworkName: Record<CasperNetwork, string> = {
  mainnet: 'casper',
  testnet: 'casper-test',
};

export const AuctionManagerContractHash: Record<Network, string> = {
  mainnet: 'ccb576d6ce6dec84a551e48f0d0b7af89ddba44c7390b690036257a04a3ae9ea',
  testnet: '93d923e336b20a4c4ca14d592b60e5bd3fe330775618290104f9beb326db7ae2',
};

export const AuctionPoolContractHash: Record<Network, string> = {
  mainnet: '6174cf2e6f8fed1715c9a3bace9c50bfe572eecb763b0ed3f644532616452008',
  testnet: '6174cf2e6f8fed1715c9a3bace9c50bfe572eecb763b0ed3f644532616452008',
};

export const CSPRMarketContractHash: Record<Network, string> = {
  mainnet: '31cc023b17c903a963ec60eab96a60f1fa37cb74b4b3bafc91a441e0e9d70f97',
  testnet: '154ff59b5f9feec42d3a418058d66badcb2121dc3ffb2e3cf92596bf5aafbc88',
};

export const CSPRStudioCep47ContractHash: Record<Network, string> = {
  mainnet: 'c4e5a03066ce3c6006f562939e48f7076c77de5d46cf8fe625c41e02c5e74814',
  testnet: '998af6825d77da15485baf4bb89aeef3f1dfb4a78841d149574b0be694ce4821',
};

export const AssociatedKeysContractHash: Record<Network, string> = {
  mainnet: 'b2ec4f982efa8643c979cb3ab42ad1a18851c2e6f91804cd3e65c079679bdc59',
  testnet: '676794cbbb35ff5642d0ae9c35302e244a7236a614d7e9ef58d0fb2cba6be3ed',
};

export const ExecutionTypesMap: Record<number, string> = {
  1: 'wasmDeploy', //"ModuleBytes"
  2: 'contractCall', //"StoredContractByHash"
  3: 'contractCall', //"StoredContractByName",
  4: 'contractCall', //"StoredVersionedContractByHash",
  5: 'contractCall', //"StoredVersionedContractByName",
  6: 'transfer',
};

export const CSPR_COIN: IToken = {
  contractHash: '',
  contractPackageHash: '',
  decimals: CSPR_DECIMALS,
  iconUrl: 'CSPR',
  id: 'CSPR-mainnet',
  name: 'Casper',
  network: 'mainnet',
  symbol: 'CSPR',
  balance: '0',
  decimalBalance: '0',
  formattedDecimalBalance: '0',
  isNative: true,
} as const;

export const CSPR_BALANCE: ICsprBalance = {
  totalBalance: '0',
  totalDecimalBalance: '0',
  totalFormattedDecimalBalance: '0',

  liquidBalance: '0',
  liquidDecimalBalance: '0',
  liquidFormattedDecimalBalance: '0',

  delegatedBalance: '0',
  delegatedDecimalBalance: '0',
  delegatedFormattedDecimalBalance: '0',

  undelegatingBalance: '0',
  undelegatingDecimalBalance: '0',
  undelegatingFormattedDecimalBalance: '0',
} as const;

export const CSPR_TRANSFER_PAYMENT_AMOUNT = '0.1';
export const CSPR_DELEGATION_PAYMENT_AMOUNT = '2.5';
export const CSPR_DELEGATION_MIN_AMOUNT = '500';
export const CSPR_TRANSFER_MIN_AMOUNT = '2.5';
export const CEP18_DEFAULT_TRANSFER_PAYMENT_AMOUNT = '1.5';
export const NFT_DEFAULT_TRANSFER_PAYMENT_AMOUNT: Record<NftStandard, string> = {
  CEP47: '1',
  CEP78: '3',
};
