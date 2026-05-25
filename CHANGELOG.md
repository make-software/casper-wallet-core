# Changelog

All notable changes to **CasperWalletCore** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/make-software/casper-wallet-core/compare/v1.3.0...HEAD
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
