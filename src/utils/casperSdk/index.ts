/**
 * Barrel over the Casper-protocol helpers. `./cep-nft-transfer` and `./dex-contract` link
 * `casper-js-sdk`; the other three modules are deliberately SDK-free.
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
 *
 * `./cep-nft-transfer` is deliberately NOT re-exported here: this barrel is reached from the
 * `utils` barrel, which most of `src/data` imports, so re-exporting it made every DTO a
 * transitive SDK importer for builds that do not shake. It is re-exported from the package root
 * instead, so the public API is unchanged (WALLET-1421).
 *
 * `./dex-contract` is left out for the same reason, and is not re-exported from the package root
 * either — it is internal to `src/data/repositories/dex`.
 */

export * from './accountHash';
export * from './network';
export * from './blockExplorer';
