export const DI_SYMBOLS = {
  HttpDataProvider: Symbol.for('HttpDataProvider'),

  CasperNetworkRepository: Symbol.for('CasperNetworkRepository'),
  TokensRepository: Symbol.for('TokensRepository'),
  DeploysRepository: Symbol.for('DeploysRepository'),
  NftsRepository: Symbol.for('NftsRepository'),
  ValidatorsRepository: Symbol.for('ValidatorsRepository'),
  OnRampRepository: Symbol.for('OnRampRepository'),
  AccountInfoRepository: Symbol.for('AccountInfoRepository'),

  Logger: Symbol.for('Logger'),
} as const;
