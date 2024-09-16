type SecretKey = string;
type PublicKey = string;

interface KeyPair {
  secretKey: SecretKey;
  publicKey: PublicKey;
}

export interface IAccount extends KeyPair {
  label: string;
  imported?: boolean;
  derivationIndex?: number;
}

export interface IAccountWithCsprBalance extends IAccount {
  formattedCsprBalance: string;
}

export type AuctionManagerEntryPointType = 'DELEGATE' | 'UNDELEGATE' | 'REDELEGATE';
