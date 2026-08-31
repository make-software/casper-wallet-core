/**
 * Barrel over the Casper-protocol helpers. `./cep-nft-transfer`, `./dex-contract`, `./rpcClient`,
 * `./tx-builders` and `./validation` link `casper-js-sdk`; `./accountHash`, `./network` and
 * `./blockExplorer` are deliberately SDK-free and are the only modules re-exported here.
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
 * - `casper-wallet-core/src/utils/casperSdk/tx-builders` — `build*Transactions` for transfers,
 *   CEP-18 and the auction manager
 * - `casper-wallet-core/src/utils/casperSdk/validation` — `isValidCasperPublicKey`
 *
 * The package declares `"sideEffects": false`, so a bundler that tree-shakes will also drop the
 * unused halves when importing through this barrel or the package root — the deep paths are the
 * guarantee for builds that do not.
 *
 * No SDK-linked module is re-exported here: this barrel is reached from the `utils` barrel, which
 * most of `src/data` imports, so re-exporting one would make every DTO a transitive SDK importer
 * for builds that do not shake. The package root exports `./cep-nft-transfer`, `./tx-builders` and
 * `./validation` instead. `./dex-contract` and `./rpcClient` are exported nowhere — they are
 * internal to `src/data/repositories`.
 */

export * from './accountHash';
export * from './network';
export * from './blockExplorer';
