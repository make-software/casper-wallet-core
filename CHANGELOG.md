# Changelog

All notable changes to **CasperWalletCore** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-09-21 — Swap / DEX, shared transactions and Ledger

### Added

**Swap / DEX** — `domain/swap`, `domain/dex`, `repositories/swap` (trade API: token list, quotes)
and `DexContractRepository` (allowance reads; approval, revoke, swap, wrap and unwrap builders),
wired into `setupRepositories()` as `swapRepository` and `dexContractRepository`.
`setupRepositories` / `setupSigningRepositories` accept `dexConfig`; `setupDataRepositories`
accepts `tradeApiByNetworkUrl` and `wrappedCsprContractPackageHash`.

- `IDexConfig.expectedProxyWasmSha256` (optional, **strongly recommended**) — hex sha256 of
  `proxy_caller.wasm`, verified before the build. The bytes run as session code in the caller's
  account context with access to their main purse, and the UI shows only "ModuleBytes". The
  library pins no value: the binary is a per-deployment artifact.
- `buildSwapTransaction` validates the quoted route, `slippage` and `deadline` before encoding,
  and derives the on-chain deadline from chain time, not the device clock.
- `getAllowance` rejects with a `DexError` on RPC failure, so `''` means only "no allowance entry
  for this spender". `DexContractRepository` refuses an empty contract package hash.

**Flow layer** — `domain/flows` and `src/data/flows` (root-exported): `createSwapFlowRunner` /
`createWrapFlowRunner` run approve → settle → swap → settle and publish it as a hot, replayed
`events$`. Unsubscribing never cancels a running flow — only `handle.cancel()` does — and
`runner.getActive(id)` reattaches a remounted surface. A runner is bound to one account
(`readonly publicKey`); rebuild both when the active account changes.

- `IStartSwapFlowParams.pendingApproval` (optional) — an approval this trade already submitted.
  The flow waits on it instead of paying for a second one; ignored once the allowance is on chain.
- `ITransactionStatusRepository` (`transactionStatusRepository`) polls node RPC until a submitted
  transaction executes, separating a `TransactionTimeoutError` from an executed outcome with
  `status: 'failure'`.
- `ITransactionOutcome`, `ISwapFlowResult` and `IWrapFlowResult` are discriminated unions. On the
  success arm `outcome` is absent when `awaitSettlement` was `false` — read it, not `status`, to
  tell submitted from settled.

**Casper transactions and signing** — `domain/casperTransactions` (`ICasperSigner`,
`ICasperTransactionsRepository`, `CasperTransactionsError`) and `CasperTransactionsRepository`,
which owns RPC client construction, node-time drift correction and API-version detection, and
submits `putTransaction` (node 2.x) or the legacy `putDeploy` (node 1.x).

- Composed path: `sendTokenTransfer`, `sendNftTransfer`, `sendDelegation`, `sendDexTransaction`.
  Granular path: `signTransaction` / `sendSignedTransaction`.
- `createPrivateKeySigner` (`src/data/signers`) verifies the key pair before signing, raising
  `KeyPairMismatchError` — a mismatched pair would otherwise sign under the wrong curve and be
  rejected by the node after payment.
- Pure builders, root-exported: `buildCsprTransferTransactions`,
  `buildCep18TransferTransactions`, `buildNftTransferTransactions`,
  `buildAuctionManagerTransactions`, `AuctionManagerEntryPointMap` — each returns the
  `{transaction, fallbackDeploy}` pair.
- `isValidCasperPublicKey`, `createCasperMessageBytes`, `isTransactionSignedBy`,
  `getPrivateKeyHexFromSecretKey`.
- `setup*` accepts `rpcOptions` (`handlerType`, `referrerMode`, `authorizationHeader`). Defaults
  stay browser-safe (`fetch` + `fetch-referrer`); mobile passes
  `{ handlerType: 'axios', referrerMode: 'referer-header' }`.

**Ledger** — `domain/ledger` and `CasperLedgerService` (root-exported), one device class for both
Web HID/USB and React Native BLE. Transport creation, availability checks,
pairing-invalidation classification, session restore and the Casper app object are injected, so
`@zondax/ledger-casper` and `@ledgerhq/hw-transport` stay out of the import graph — both are
**optional peer dependencies**. Adds `rxjs` as a dependency.

- `createLedgerSigner` presents the service as an `ICasperSigner`, so hardware and software keys
  drive the same send paths.
- `ledgerEvents$` and `connected$`, alongside `subscribeToLedgerEventStatus`. `connected$` also
  moves on statuses the event stream reports as something else — a locked device arrives as
  `DeviceLocked` — so mirroring the stream leaves a stale `true`.
- `ILedgerTransport.observeState` (optional) with `LedgerDeviceState` / `LedgerDeviceStatus` — a
  transport that can report device state pushes it instead of being polled. Implementing it
  commits the adapter to emitting state changes unprompted for as long as it has a subscriber; an
  adapter that cannot guarantee that should leave the member off.
- `LEDGER_SUBMIT_OUTCOME_STATUSES` / `ledgerEventAnswersSubmit` — the six statuses that answer for
  a submit, so a client never re-issues one the device already signed. `LEDGER_ERROR_STATUSES`
  cannot serve: it also holds interruptions.
- `createLedgerSubmitResume` — whether an outstanding submit may be re-issued once the device
  comes back. The submit boundary stays the caller's.
- `isLedgerSignatureCancelled` / `LEDGER_CANCELLATION_STATUSES` — the default
  `isCancellationError` for both flows. `LedgerError` carries its `ledgerEvent`.

**React layer** — `casper-wallet-core/src/react`, deep-imported and free of `casper-js-sdk`.
`react` and `@tanstack/react-query` are optional peers. See `docs/swap-react-integration.md`.

- `useReviewSwap` / `useReviewWrap` subscribe to the flow runners instead of owning the
  sign/submit/settle sequence; both return `ledgerEvent`.
- `useSwapTokens` returns `quotedTrade` — tokens, route and quote type read off one quote.
  `useReviewSwap` takes it as one `trade` bundle, so an amount can never be paired with a previous
  quote's bound.

**Errors** — `DomainError` (`domain/common`) is the base every domain error now extends, keeping
the originating error on a non-enumerable `sourceError`.

- `getNodeErrorDetails` walks the `sourceError` chain for node-provided detail (`message`,
  JSON-RPC `code`, `statusCode`, `data`), or returns `null`.
- `CORE_ERROR_MESSAGE_KEYS` / `CoreErrorMessageKey` — the exhaustive catalogue of i18n keys core
  can put in an error `message`. Core ships no copy; an incomplete consumer map is a compile error.

**Utils** — `amounts`, `swap` and `decimal` in the barrel.
`calculateMinAmountWithSlippage` / `calculateMaxAmountWithSlippage` throw on an out-of-range
slippage. `getTransactionErrorMessage` renders a `LedgerError` as its device status.

### Changed

- **BREAKING — `IBuiltDexTransaction` is a discriminated union.** Narrow with
  `'transaction' in built` instead of asserting `deploy ?? transaction!`.
- **BREAKING — `useCsprFeeValidation`'s parameters are a union of its two modes.** Supplying
  neither no longer compiles.
- **BREAKING — three domain fields renamed to camelCase**; the old names will not compile:
  - `INft.owner_reverse_lookup_mode` → `ownerReverseLookupMode`
  - `IAppMarketingEvent.image_url` → `imageUrl`
  - `IOnRampCurrencyItem.type_id` → `typeId`
- **`getBlockchainAmount` truncates (`ROUND_DOWN`) instead of rounding half-up**, so it can never
  return more base units than the caller typed. `('1.9999999995', 9)` → `'1999999999'` (was
  `'2000000000'`); `('0.0000000005', 9)` → `'0'` (was `'1'`). Wallet-wide: it affects transfer and
  payment amounts, not only swap.
- **`formatFiatBalance` tests the one-cent floor against the actual amount, not the rounded one.**
  At the default `decimals = 2`, `[0.005, 0.01)` renders `<$0.01` instead of `$0.01` — wallet-wide,
  through `formatFiatAmount`, `getCep18FiatAmount` and `getCsprFiatAmount`. `getFiatAmount` passes
  `decimals: 4` and is unaffected.
- **`getDecimalTokenBalance` is exact at any size.** `('123456789012345678901234', 9)` →
  `'123456789012345.678901234'` (was `'123456789012345.6789'`). Backs `Cep18TokenDto.decimalBalance`
  and every deploy DTO's `decimalAmount`. Reachable for an 18-decimal CEP-18 token.
- **`casper-js-sdk` moves to `5.1.1`**, still an exact pin — consuming apps must pin the same
  version, or transaction bytes come off two different builders.
- **`checkAppInfo()` names a locked device.** `0x5515` → `DeviceLocked`, an unclassified status
  word → `ErrorOpeningDevice`, a non-Casper app → `CasperAppNotLoaded`, no connection →
  `Disconnected`. `WaitingResponseFromDevice` is no longer in its range, so give each of these
  error framing rather than live progress.
- **`connect()` serialises concurrent attempts** and closes a transport before replacing it;
  `disconnect()` does so whether or not the attempt ever reached "connected".
- Every domain error class now extends `DomainError`. Construction, `type`, `name` and `traceable`
  are unchanged; each instance additionally carries `sourceError`.

### Fixed

- `withProxyHeader` reached the account-info lookup nested inside the deploys and
  signature-request repositories, which always sent the `Referer` header — forbidden on web, so
  the browser dropped it and logged "Refused to set unsafe header" on every feed, deploy and
  signature-request fetch.

### Removed

Only pre-release builds of 2.0.0 exposed these; they are listed for the apps already integrating.

- `createDexTransactionSender`, `IDexTransactionSender`, `ITransactionCallbacks` (`domain/dex`) —
  superseded by the flow runners, which consume an `ICasperSigner` directly. Settlement is
  core-owned via `transactionStatusRepository`.
- `ApprovalState` and the hooks that orchestrated sign/submit/settle: `useSwapStates`,
  `useTransactionStatuses`, `useTokenApprovalFlow`, `useSwapTransaction`, `useWrapTransaction`.
  `dexContractRepository.checkApprovalRequired` stays public.

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

[2.0.0]: https://github.com/make-software/casper-wallet-core/compare/v1.4.0...v2.0.0
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
