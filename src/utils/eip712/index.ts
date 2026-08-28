// `./sign` is the only module here that links `casper-js-sdk` (it needs `PrivateKey`), and this
// barrel is reached from the `utils` barrel that most of `src/data` imports. It is re-exported
// from the package root instead, so the public API is unchanged — import it by path
// (`casper-wallet-core/src/utils/eip712/sign`) from anywhere that already links the SDK.
export * from './address';
export * from './validation';
export * from './digest';
export * from './displayModel';
export * from './recover';
