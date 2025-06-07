export interface IEntity {
  readonly id: string;
}

export type CasperNetwork = 'mainnet' | 'testnet' | 'devnet' | 'integration';
export type Network = CasperNetwork;
export type AvailableLanguageTags = 'en';
export type SupportedFiatCurrencies = 'USD';

export interface IContractInfo {
  contractHash: string;
  contactName: string;
  contractPackageHash: string;
  contractPackageName: string;
}
