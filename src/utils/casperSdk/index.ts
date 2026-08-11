/**
 * Barrel over the Casper-protocol helpers. Only `./cep-nft-transfer` links `casper-js-sdk`; the
 * other three modules are deliberately SDK-free.
 *
 * `casper-js-sdk` ships a single prebuilt UMD bundle (`dist/lib.web.js` — no `module` field, no
 * `import` condition, no `sideEffects` flag), so one import of it costs the whole ~900 KB blob and
 * nothing can be shaken out. Consumers on a startup path should import the module they need
 * directly rather than this barrel:
 *
 * - `casper-wallet-core/src/utils/casperSdk/accountHash` — `getAccountHashFromPublicKey`
 * - `casper-wallet-core/src/utils/casperSdk/network` — `getCasperNetworkByChainName`
 * - `casper-wallet-core/src/utils/casperSdk/blockExplorer` — `getBlockExplorer*Url`, `getContractNftUrl`
 * - `casper-wallet-core/src/utils/casperSdk/cep-nft-transfer` — the SDK-backed deploy builders
 *
 * The package declares `"sideEffects": false`, so a bundler that tree-shakes will also drop the
 * unused halves when importing through this barrel or the package root — the deep paths are the
 * guarantee for builds that do not.
 */

export * from './accountHash';
export * from './network';
export * from './blockExplorer';
export * from './cep-nft-transfer';
