import { AccountInfoError, isAccountInfoError } from './accountInfo/errors';
import { AppEventsError, isAppEventsError } from './appEvents/errors';
import { ContractPackageError, isContractPackageError } from './contractPackage/errors';
import { DexError, isDexError } from './dex/errors';
import { EIP712Error, isEIP712Error } from './eip712/errors';
import { isNftsError, NftsError } from './nfts/errors';
import { isOnRampError, OnRampError } from './onRamp/errors';
import { isSwapError, SwapError } from './swap/errors';
import { isTokensError, TokensError } from './tokens/errors';
import { isTxSignatureRequestError, TxSignatureRequestError } from './tx-signature-request/errors';
import { isValidatorsError, ValidatorsError } from './validator/errors';

const CASES: {
  label: string;
  build: (e: unknown) => Error & { type: unknown; traceable: boolean; sourceError: unknown };
  name: string;
  guard: (e: unknown) => boolean;
}[] = [
  {
    label: 'AccountInfoError',
    build: e => new AccountInfoError(e, 'getAccountsInfo'),
    name: 'AccountInfoRepositoryError',
    guard: isAccountInfoError,
  },
  {
    label: 'AppEventsError',
    build: e => new AppEventsError(e, 'getReleaseEvents'),
    name: 'AppEventsRepositoryError',
    guard: isAppEventsError,
  },
  {
    label: 'ContractPackageError',
    build: e => new ContractPackageError(e, 'getContractPackage'),
    name: 'ContractPackageRepositoryError',
    guard: isContractPackageError,
  },
  {
    label: 'DexError',
    build: e => new DexError(e, 'getAllowance'),
    name: 'DexRepositoryError',
    guard: isDexError,
  },
  {
    label: 'EIP712Error',
    build: e => new EIP712Error(e, 'computeDigest'),
    name: 'EIP712Error',
    guard: isEIP712Error,
  },
  {
    label: 'NftsError',
    build: e => new NftsError(e, 'getNfts'),
    name: 'NftsRepositoryError',
    guard: isNftsError,
  },
  {
    label: 'OnRampError',
    build: e => new OnRampError(e, 'getOnRampCountriesAndCurrencies'),
    name: 'OnRampRepositoryError',
    guard: isOnRampError,
  },
  {
    label: 'SwapError',
    build: e => new SwapError(e, 'getQuote'),
    name: 'SwapRepositoryError',
    guard: isSwapError,
  },
  {
    label: 'TokensError',
    build: e => new TokensError(e, 'getTokens'),
    name: 'TokensRepositoryError',
    guard: isTokensError,
  },
  {
    label: 'TxSignatureRequestError',
    build: e => new TxSignatureRequestError(e, 'invalidSignatureRequest'),
    name: 'TxSignatureRequestRepositoryError',
    guard: isTxSignatureRequestError,
  },
  {
    label: 'ValidatorsError',
    build: e => new ValidatorsError(e, 'getCurrentEraId'),
    name: 'ValidatorsRepositoryError',
    guard: isValidatorsError,
  },
];

describe.each(CASES)('$label', ({ build, name, guard }) => {
  it('keeps its name, type, message, stack and source error', () => {
    const inner = new Error('boom');
    const err = build(inner);

    expect(err.name).toBe(name);
    expect(err.type).toBeDefined();
    expect(err.message).toBe('boom');
    expect(err.stack).toBe(inner.stack);
    expect(err.traceable).toBe(true);
    expect(err.sourceError).toBe(inner);
  });

  it('is matched by its own type guard and by no other error', () => {
    expect(guard(build(new Error('boom')))).toBe(true);
    expect(guard(new Error('boom'))).toBe(false);
  });
});
