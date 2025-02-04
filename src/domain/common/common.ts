export interface IEntity {
  readonly id: string;
}

export type CasperNetwork = 'mainnet' | 'testnet' | 'devnet';
export type Network = CasperNetwork;
export type AvailableLanguageTags = 'en';
export type SupportedFiatCurrencies = 'USD';
