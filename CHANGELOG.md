# Changelog

All notable changes to **CasperWalletCore** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Shared Casper transaction, signing and submission layer (Phase 1).** New
  `domain/casperTransactions` (`ICasperSigner`, `ICasperTransactionsRepository`,
  `CasperTransactionsError`), a `CasperTransactionsRepository` that owns node-RPC client
  construction, node-time drift correction and API-version detection, and submits either a
  `putTransaction` (node 2.x) or the legacy `putDeploy` (node 1.x) — mirroring mobile/extension
  byte-for-byte. It exposes both a composed path (`sendTokenTransfer`, `sendNftTransfer`,
  `sendDelegation` — build, sign, submit in one call, mobile parity) and a granular one
  (`signTransaction` / `sendSignedTransaction`, for the extension's multi-window sign-then-submit
  UX), plus `sendDexTransaction` for the swap flow's built artifact.
- **Shared Ledger layer (Phase 2).** New `domain/ledger` (`LedgerEventStatus` — the union of
  both apps' event sets, `ILedgerEvent`, `LedgerAccount`, `SignResult`, transport types,
  `LedgerError`, `LEDGER_ERROR_STATUSES`, `isLedgerErrorEvent`) and `CasperLedgerService`
  (`src/data/ledger`, root-exported), one device class replacing the near-identical
  implementations in both apps. Transport creation, availability checks, pairing-invalidation
  classification and session restore are injected, so the same service drives Web HID/USB and
  React Native BLE. The on-device identity pre-flight the extension had now applies to both.
  Adds `@zondax/ledger-casper`, `@ledgerhq/hw-transport` and `rxjs` as dependencies.
- **`createLedgerSigner`** — presents a `CasperLedgerService` as an `ICasperSigner`, so hardware
  and software keys drive the same send paths. `supportsTransactionV1Cb` and the session-restore
  callback are bound at signer construction rather than passed per transfer, and a `LedgerError`
  raised inside a repository method reaches the caller unwrapped.
- **`createPrivateKeySigner`** (`src/data/signers`) — an `ICasperSigner` over the
  `{publicKeyHex, secretKeyBase64}` pair both apps already store; the software-key counterpart to
  the Phase-2 Ledger signer.
- **Pure transaction builders** (`src/utils/casperSdk/tx-builders.ts`, root-exported):
  `buildCsprTransferTransactions`, `buildCep18TransferTransactions`,
  `buildNftTransferTransactions`, `buildAuctionManagerTransactions` and
  `AuctionManagerEntryPointMap` — each returns the `{transaction, fallbackDeploy}` pair mobile and
  the extension hand-roll today. The NFT fallback deploy is now built directly via
  `makeNftTransferDeploy` instead of the `casperNetworkApiVersion: '1.5.8'` round-trip hack (the
  two are provably byte-identical).
- `isValidCasperPublicKey` (`src/utils/casperSdk/validation.ts`, root-exported) and shared
  message/key helpers in `src/utils/transactions.ts`: `createCasperMessageBytes`,
  `isTransactionSignedBy`, `getPrivateKeyHexFromSecretKey`.
- `setupRepositories` / `setupSigningRepositories` return a `casperTransactionsRepository` and
  accept an optional `rpcOptions` (`ICasperRpcOptions`: `handlerType`, `referrerMode`,
  `authorizationHeader`), threaded into both `casperTransactionsRepository` and
  `dexContractRepository`. Defaults stay browser-safe (`fetch` + `fetch-referrer`); mobile passes
  `{ handlerType: 'axios', referrerMode: 'referer-header' }`.
- Package root additionally exports `./src/data/signers`, `./src/utils/casperSdk/tx-builders` and
  `./src/utils/casperSdk/validation`.

### Changed

- **`DexContractRepository`'s node-RPC client now sets the CSPR.cloud proxy referrer by
  default.** It previously built its client with no referrer at all; it now goes through the same
  `createCasperRpcClient` helper as `casperTransactionsRepository` and `txSignatureRequest`, so an
  un-configured consumer picks up the `fetch` + `fetch-referrer` default. Pass `rpcOptions` to
  `DexContractRepository` (or via `setupRepositories`) to opt out.
- **BREAKING — the swap `ISigner` port is renamed `IDexTransactionSender` and moved from
  `src/react/types.ts` to `domain/dex`.** It is no longer an interface apps implement: core builds
  it via `createDexTransactionSender({ signer, casperTransactionsRepository, network,
supportsTransactionV1, waitForTransaction, isCancellationError? })`, which signs and
  submits through `sendDexTransaction` and drives `ITransactionCallbacks` (also moved to
  `domain/dex`). `src/react/types.ts` re-exports both names; the `ISwapDependencies.signer` field
  name and the hooks' runtime behavior are unchanged — only the type an app hands in changes, from
  a hand-rolled sign+submit implementation to an `ICasperSigner`.

## [2.0.0] - 2026-08-30 — Swap / DEX

### Added

- **Swap / DEX domain and data layer.** New `domain/swap` and `domain/dex` (entities, repository
  interfaces, `SwapError` / `DexError`), `repositories/swap` (trade API: token list, quotes) and
  `repositories/dex` (`DexContractRepository` — allowance reads and the approval, swap, wrap and
  unwrap transaction builders), plus `dto/swap` mappers. Wired into `setupRepositories()` as
  `swapRepository` and `dexContractRepository`.
- **`src/react/` — a React hook layer** for the trade form, the review modal and the wrap/unwrap
  flow. Deep-importable as `casper-wallet-core/src/react` and free of `casper-js-sdk`. `react`
  and `@tanstack/react-query` are optional peer dependencies; a consumer that does not import
  this path needs neither. See `docs/swap-react-integration.md`.
- `setupRepositories` / `setupSigningRepositories` accept `dexConfig`; `setupDataRepositories`
  accepts `tradeApiByNetworkUrl` and `wrappedCsprContractPackageHash`.
- Swap helpers in the `utils` barrel: `amounts`, `swap`, `decimal`.

### Changed

- **BREAKING — three published domain interface fields renamed to camelCase.** Consuming code
  reading the old names will not compile:
  - `INft.owner_reverse_lookup_mode` → `INft.ownerReverseLookupMode`
  - `IAppMarketingEvent.image_url` → `IAppMarketingEvent.imageUrl`
  - `IOnRampCurrencyItem.type_id` → `IOnRampCurrencyItem.typeId`
- **`getBlockchainAmount` now truncates instead of rounding half-up.** It previously used
  decimal.js's default `ROUND_HALF_UP`; it now uses `ROUND_DOWN`, so it can never hand back more
  base units than the caller typed. An amount whose fraction extends past `decimals` now
  converts one base unit lower — `getBlockchainAmount('1.9999999995', 9)` returns
  `'1999999999'`, previously `'2000000000'`; `getBlockchainAmount('0.0000000005', 9)` returns
  `'0'`, previously `'1'`. This is an exported util: it affects transfer and payment amounts in
  consuming apps, not only the swap flow.
- **`formatFiatBalance` now tests the one-cent floor against the actual amount, not the rounded
  one.** With the default `decimals = 2`, a balance in `[0.005, 0.01)` renders `<$0.01` where it
  previously rounded up to `$0.01`. This is deliberate and applies wallet-wide, not only to
  swap: it changes the rendered fiat string on existing deploy-history rows and CEP-18 token
  rows, through `formatFiatAmount`, `getCep18FiatAmount` and `getCsprFiatAmount`. `getFiatAmount`
  passes `decimals: 4` and is unaffected.
- `IDexConfig.getProxyWasm` is required. `dexConfig` as a whole stays optional — omit it and
  `dexContractRepository` still builds approvals — but supplying a `dexConfig` without the proxy
  WASM loader is now a compile error rather than a runtime failure at the Confirm button.
- `DexContractRepository.getAllowance` rejects with a `DexError` on an RPC failure instead of
  resolving `''`. `''` now means only "no allowance entry for this spender".
- `buildSwapTransaction` validates its inputs before encoding: the quoted route must start at the
  input token and end at the output token, `slippage` must be within `[0, MAX_SLIPPAGE]` and
  `deadline` within `[MIN_DEADLINE, MAX_DEADLINE]`. The on-chain deadline is derived from chain
  time (`getLatestBlockTime`) rather than the device clock.
- `calculateMinAmountWithSlippage` and `calculateMaxAmountWithSlippage` throw on a slippage
  outside their valid range instead of returning an inverted or unprotected bound.
- `IBuiltDexTransaction` is a discriminated union: exactly one of `transaction` / `deploy` is
  present, so a signer adapter narrows with `'transaction' in built` instead of asserting
  `deploy ?? transaction!`.
- `useCsprFeeValidation`'s parameters are a union of its two modes. Supplying neither — which
  silently validated against an amount of `'0'`, i.e. gas only — no longer compiles.
- Swap failures reach the consumer as the real message rather than a single `'Transaction
failed'` string, scoped to the leg that produced them, and the review flow returns to its
  confirm step so it stays retryable. `ApprovalState.transactionHash` is now populated.

## [1.4.0] - 2026-06-30 — EIP-712 typed-data signing

### Added

- **EIP-712 typed-data signing module.** New `eip712` domain (entities, repository interface, errors), `repositories/eip712` implementation, `dto/eip712` mappers, and `utils/eip712` helpers (`address`, `digest`, `displayModel`, `recover`, `sign`, `validation`). Supports parsing, validating, building a human-readable display model for, signing, and recovering EIP-712 typed data. Wired into `setupRepositories()` as `eip712Repository`. (#41, #42)
- EIP-712 display enrichment: decode `address` values as Casper keys, human-readable date presentation, and CAIP-2 chain identification. (#51)
- `contractPackageHash` support for CsprTrade token URLs — `getMarketDataProviderUrl()` now deep-links to `https://cspr.trade/token-details/<hash>` instead of the site root. (#43)

### Changed

- Renamed EIP-712 repository methods onto the `…TypedData…` convention (`EIP712Repository.signTypedData`). (#47, #52)
- Bumped CI workflow actions: `actions/checkout` 4→7, `actions/setup-node` 4→6, `actions/upload-artifact` 4→7, `github/codeql-action` 3→4. (#28, #29, #30, #31, #48)
- Bumped runtime and dev dependencies, including `lint-staged` 15→17. (#37, #40, #44, #49)

### Fixed

- Dropped a duplicated chain-name row from the EIP-712 domain rows. (#46)

## [1.3.0] - 2026-05-18

### Added

- Jest-based unit + integration test suite covering DTOs, repositories, and utilities (`src/**/*.test.ts`, `src/setup.integration.test.ts`).
- `scripts/generate-tx-fixtures.cjs` for regenerating transaction test fixtures.
- Grouped logging support in `ILogger` / `Logger` with structured, conditional API-response logging.
- `@types/node` to dev dependencies for improved Node.js type support.
- GitHub Actions workflows for CI (`.github/workflows/ci.yml`) and CodeQL analysis (`.github/workflows/codeql.yml`).
- Issue templates (`bug_report.yml`, `feature_request.yml`, `config.yml`), pull request template, and `CODEOWNERS`.
- Dependabot configuration (`.github/dependabot.yml`) for automated dependency updates.
- Developer Certificate of Origin (`.github/developer-certificate-of-origin`) and expanded `CONTRIBUTING.md` / `SECURITY.md`.
- `.nvmrc` to pin the Node.js version used for development.
- `.editorconfig` for consistent code styling across editors.
- `fast-check` dev dependency and property-based tests for fiat and token formatters (`src/utils/common.property.test.ts`).
- Extended `package.json` metadata: `description`, `license`, `author`, `keywords`, repository fields.
- New NPM scripts for formatting (`yarn format`, `yarn format:check`).

### Changed

- Migrated ESLint config from `.eslintrc.js` to flat-config (`eslint.config.js`) and upgraded ESLint and related plugins.
- `tsconfig.json` switched to a custom configuration (removed `@react-native/typescript-config`); `module` set to `nodenext`.
- Enabled stricter TypeScript compiler options: `noImplicitOverride`, `noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames`.
- Upgraded `typescript` to `5.9.3` and `uuid` to `14.0.0`.
- `src/utils/crypto.ts` updated for `ArrayBuffer` compatibility.
- Bumped `lru-cache` to `11.3.6` and adjusted the `engines.node` requirement.
- Reformatted tests and source files for improved readability and consistency.

### Fixed

- Internal refactors and dependency overrides to ensure consistent behavior across Node 20 and Node 22.

## [1.2.1]

Tag exists; no GitHub release notes were published. See the
[v1.2.0…v1.2.1 diff](https://github.com/make-software/casper-wallet-core/compare/v1.2.0...v1.2.1).

## [1.2.0] - 2026-03-30 — Activity feed

### Added

- Transaction activity feed.
- New source of fiat prices.

### Changed

- Improved transaction results parsing.

### Fixed

- Miscellaneous bug fixes.

## [1.1.8] - 2025-12-22 — Wasm proxy identification

### Added

- WASM Proxy identification in transaction history.

### Changed

- Improved NFT transaction parsing.
- Improved Undelegate transaction parsing.

## [1.1.7] - 2025-12-02 — Market data

### Added

- `iconUrl` support on deploy DTOs and entities.
- Support for handling CEP-18 entry points; `TxSignatureRequestDto` now validates with `isCep18Action`.

### Changed

- Refined CEP-18 entry-point validation logic.
- `cep-nft-transfer` updated to specify `CLTypeUInt8` for `CLOption` initialization, ensuring proper type handling.
- Refactored repositories to consume environment-based and network-based Casper Wallet API URLs; setup logic updated for improved configurability and maintainability.
- Changed `balance` type from `number` to `string` in token and account response models to ensure consistent handling of large values.

## [1.1.6]

Tag exists; no GitHub release notes were published. See the
[v1.1.5…v1.1.6 diff](https://github.com/make-software/casper-wallet-core/compare/v1.1.5...v1.1.6).

## [1.1.5]

Tag exists; no GitHub release notes were published. See the
[v1.1.4…v1.1.5 diff](https://github.com/make-software/casper-wallet-core/compare/v1.1.4...v1.1.5).

## [1.1.4] - 2025-08-14 — Market data

### Added

- Fiat balance calculations and market data support for tokens using CoinGecko and FriendlyMarket APIs.

## [1.1.3] - 2025-07-21 — Fixes and improvements

### Fixed

- `callerPublicKey` field on the list of CSPR transfers.

## [1.1.2] - 2025-07-14 — Fixes and improvements

### Added

- Support for CEP-95 NFT.
- `IContractPackage` logic.

### Fixed

- Issues with CasperMarket's action on the signature request.

## [1.1.1] - 2025-07-03 — Fixes and improvements

### Changed

- Updated check for WASM proxy.
- Updated `cspr.name` resolution logic.

### Fixed

- Multisig transactions weight calculation.

## [1.1.0] - 2025-06-13 — SignatureRequest

### Added

- `SignatureRequest` business logic.

### Changed

- Refactored `Deploy` business logic.

### Fixed

- Miscellaneous bug fixes.

## [1.0.5] - 2025-05-05

### Added

- App release events.
- App marketing events.

## [1.0.4] - 2025-04-07

### Changed

- Updated `Deploy` cost fetching.

## [1.0.3] - 2025-04-06

### Added

- `tokenIdType` on `INft`.

### Changed

- Library dependencies updated.

## [1.0.2] - 2025-04-05

### Added

- Documentation.

### Changed

- Delegated balances disabled by default.

## [1.0.1] - 2025-02-27

### Added

- Delegation amount min/max validation.
- Validator's reserved-slots data.
- New CSPR Transfer identification logic.

### Fixed

- Miscellaneous bug fixes.

## [1.0.0] - 2025-01-22

- Initial public release. Contains the common logic shared between the Casper Wallet browser extension and the Casper Wallet mobile app.

## [0.9.x and earlier]

Tagged but not published as GitHub Releases. See the
[tag list](https://github.com/make-software/casper-wallet-core/tags) for history.

[Unreleased]: https://github.com/make-software/casper-wallet-core/compare/v1.4.0...HEAD
[1.4.0]: https://github.com/make-software/casper-wallet-core/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/make-software/casper-wallet-core/compare/v1.2.1...v1.3.0
[1.2.1]: https://github.com/make-software/casper-wallet-core/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/make-software/casper-wallet-core/compare/v1.1.8...v1.2.0
[1.1.8]: https://github.com/make-software/casper-wallet-core/compare/v1.1.7...v1.1.8
[1.1.7]: https://github.com/make-software/casper-wallet-core/compare/v1.1.6...v1.1.7
[1.1.6]: https://github.com/make-software/casper-wallet-core/compare/v1.1.5...v1.1.6
[1.1.5]: https://github.com/make-software/casper-wallet-core/compare/v1.1.4...v1.1.5
[1.1.4]: https://github.com/make-software/casper-wallet-core/compare/v1.1.3...v1.1.4
[1.1.3]: https://github.com/make-software/casper-wallet-core/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/make-software/casper-wallet-core/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/make-software/casper-wallet-core/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/make-software/casper-wallet-core/compare/v1.0.5...v1.1.0
[1.0.5]: https://github.com/make-software/casper-wallet-core/compare/v1.0.4...v1.0.5
[1.0.4]: https://github.com/make-software/casper-wallet-core/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/make-software/casper-wallet-core/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/make-software/casper-wallet-core/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/make-software/casper-wallet-core/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/make-software/casper-wallet-core/releases/tag/v1.0.0
