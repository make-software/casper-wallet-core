# Casper Wallet Core

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/node-%3E%3D20-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Yarn](https://img.shields.io/badge/yarn-4.2.2-2c8ebb.svg?logo=yarn&logoColor=white)](https://yarnpkg.com/)

> Shared core library that powers the **[Casper Wallet](https://www.casperwallet.io/)** browser extension and mobile app.

`CasperWalletCore` is a TypeScript library that encapsulates the business logic, data access, and Casper blockchain integration shared between the [Casper Wallet Extension](https://github.com/make-software/casper-wallet) and the [Casper Wallet Mobile](https://github.com/make-software/casper-wallet-mobile) apps. It provides a clean, framework-agnostic API on top of [`casper-js-sdk`](https://github.com/casper-ecosystem/casper-js-sdk) and the Casper Wallet backend API.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Repositories](#repositories)
- [Development](#development)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)

---

## Features

- **Clean Architecture** — strict separation between `domain` (interfaces, entities, errors) and `data` (implementations, DTOs, HTTP transport).
- **Multi-network support** — mainnet, testnet, and devnet via the `CasperNetwork` enum and per-environment API URLs.
- **Type-safe domain model** — first-class TypeScript interfaces for deploys, tokens, NFTs, validators, account info, signature requests, and more.
- **Precise financial math** — all amounts and balances handled with [`decimal.js`](https://github.com/MikeMcl/decimal.js/) — never native JS numbers.
- **Pluggable HTTP transport** — built on [`apisauce`](https://github.com/infinitered/apisauce) / `axios`, injected via the `IHttpDataProvider` contract so consumers can wrap or mock it.
- **Pluggable logger** — implement `ILogger` to route logs into your host app, or enable the built-in debug logger.
- **Tree-shakable** — direct TypeScript entry (`index.ts`) re-exports `utils`, `setup`, `domain`, and `typings`; consumers pick what they need.

## Architecture

The library follows a layered, dependency-inverted design:

```
┌──────────────────────────────────────────────────────────────┐
│  Consumer (Casper Wallet Extension / Mobile)                 │
└────────────────────────────┬─────────────────────────────────┘
                             │ setupRepositories({ ... })
┌────────────────────────────▼─────────────────────────────────┐
│  src/setup.ts            Factory wiring everything together  │
└────────────────────────────┬─────────────────────────────────┘
                             │
        ┌────────────────────┴────────────────────┐
        │                                         │
┌───────▼──────────────┐               ┌──────────▼───────────┐
│ src/domain/          │◄──implements──│ src/data/            │
│   entities           │               │   repositories/      │
│   repository ifaces  │               │   dto/  (mappers)    │
│   errors             │               │   data-providers/    │
└──────────────────────┘               └──────────────────────┘
                                                 │
                                       ┌─────────▼─────────┐
                                       │  Casper Wallet API │
                                       │  casper-js-sdk     │
                                       │  gRPC endpoints    │
                                       └────────────────────┘
```

- **`src/domain/`** — interfaces only (entities, repository contracts, domain errors). No runtime code beyond constants and enums.
- **`src/data/`** — concrete implementations: repositories, API response DTO mappers, and the `HttpDataProvider`.
- **`src/utils/`** — shared helpers: `crypto`, `date`, `address`, `deploy`, `casperSdk`, `logger`, `signatureRequest`.
- **`src/typings/`** — ambient type declarations re-exported from the package root.

## Installation

This package is consumed directly by the Casper Wallet apps and is not currently published to npm. To use it in your own project, add it from this Git repository:

```bash
# yarn
yarn add github:make-software/casper-wallet-core

# npm
npm install github:make-software/casper-wallet-core
```

> Requires **Node 20** or **Node ≥ 22**, Yarn 4 (Berry).

## Quick Start

```ts
import { setupRepositories, CasperNetwork } from 'CasperWalletCore';

const {
  accountInfoRepository,
  tokensRepository,
  nftsRepository,
  deploysRepository,
  validatorsRepository,
  onRampRepository,
  appEventsRepository,
  txSignatureRequestRepository,
  contractPackageRepository,
} = setupRepositories({ debug: true });

// Fetch fungible tokens for an account on the Casper mainnet
const tokens = await tokensRepository.getTokens({
  network: CasperNetwork.Mainnet,
  publicKey: '0123...abcd',
});

// Fetch recent deploys
const deploys = await deploysRepository.getAccountDeploys({
  network: CasperNetwork.Mainnet,
  publicKey: '0123...abcd',
  page: 1,
  limit: 20,
});
```

## Configuration

`setupRepositories()` accepts an optional configuration object:

```ts
interface ISetupRepositoriesParams {
  /** Enables verbose request/response logging via the provided (or default) logger. */
  debug?: boolean;

  /** Custom logger implementing the `ILogger` interface. Defaults to the built-in `Logger`. */
  logger?: ILogger;

  /** Override Casper Wallet API URLs per network (mainnet/testnet/devnet). */
  casperWalletApiByNetworkUrl?: Record<CasperNetwork, string>;

  /** Override URLs for network-agnostic endpoints (PRODUCTION / STAGING). */
  casperWalletApiByEnvUrl?: Record<IEnv, string>;

  /** Override gRPC endpoints per network. */
  grpcUrl?: Record<CasperNetwork, string>;

  /** Optional Authorization header forwarded with every HTTP call. */
  httpAuthorizationHeader?: string;
}
```

All fields are optional — defaults point at the production Casper Wallet API.

### Custom logger

```ts
import { setupRepositories, ILogger } from 'CasperWalletCore';

const logger: ILogger = {
  log: (...args) => myTelemetry.info(args),
  warn: (...args) => myTelemetry.warn(args),
  error: (...args) => myTelemetry.error(args),
  group: label => myTelemetry.group(label),
  groupEnd: () => myTelemetry.groupEnd(),
};

setupRepositories({ debug: true, logger });
```

## Repositories

Each domain module exposes a repository interface (in `src/domain/<module>/repository.ts`) backed by an implementation in `src/data/repositories/<module>/`.

| Domain                                        | Repository                       | Responsibility                                          |
| --------------------------------------------- | -------------------------------- | ------------------------------------------------------- |
| `domain/accountInfo`                          | `accountInfoRepository`          | Resolve account names, avatars, and verified info       |
| `domain/tokens`                               | `tokensRepository`               | Fungible token balances, metadata, price data           |
| `domain/nfts`                                 | `nftsRepository`                 | NFT ownership, metadata, collections                    |
| `domain/deploys`                              | `deploysRepository`              | Deploy history, parsing, transfer details               |
| `domain/validator`                            | `validatorsRepository`           | Validator listings, delegation info, auction state      |
| `domain/onRamp`                               | `onRampRepository`               | Fiat on-ramp providers and quote handling               |
| `domain/appEvents`                            | `appEventsRepository`            | Wallet-wide announcements / app events                  |
| `domain/tx-signature-request`                 | `txSignatureRequestRepository`   | Decoding & describing transactions awaiting signature   |
| `domain/contractPackage`                      | `contractPackageRepository`      | Contract package metadata lookups                       |

> ⚠️ Note the naming asymmetry between `domain/` and `data/repositories/` (e.g. `domain/validator` ↔ `repositories/validators`, `domain/tx-signature-request` ↔ `repositories/txSignatureRequest`). Always import from the package root to avoid drift.

### Key conventions

- **Financial math:** always use `Decimal` from `decimal.js`. Never use native JS numbers for balances or amounts.
- **HTTP:** all network access flows through `IHttpDataProvider`. Repositories receive it via constructor injection — easy to mock in tests.
- **Errors:** domain errors implement the `IDomainError` interface and are re-exported from each module.

## Development

```bash
# Install dependencies (Yarn 4 / Berry)
yarn install

# Type check + lint
yarn code:check

# Lint with auto-fix
yarn lint

# Type check only
tsc --skipLibCheck --noEmit
```

### Code style

- Single quotes, trailing commas, 2-space indent, 100-char print width.
- Arrow parens omitted (`x => x`, not `(x) => x`).
- All commits require a [DCO sign-off](https://developercertificate.org/): use `git commit -s` to add a `Signed-off-by:` trailer.

## Testing

Jest is used for unit and integration tests, with `ts-jest` handling TypeScript directly.

```bash
# Run the full suite
yarn test

# Watch mode
yarn test:watch

# Coverage report
yarn test:coverage

# Integration tests only
yarn test:integration

# Regenerate transaction test fixtures
yarn fixtures:generate
```

Tests live next to the code they cover (e.g. `src/utils/common.test.ts`, `src/data/dto/deploys/DeployDto.test.ts`).

## Project Structure

```
.
├── index.ts                    # Package entry — re-exports utils, setup, domain, typings
├── src/
│   ├── setup.ts                # setupRepositories() factory
│   ├── domain/                 # Interfaces, entities, errors (no implementations)
│   │   ├── accountInfo/
│   │   ├── appEvents/
│   │   ├── common/
│   │   ├── constants/
│   │   ├── contractPackage/
│   │   ├── deploys/
│   │   ├── env/
│   │   ├── nfts/
│   │   ├── onRamp/
│   │   ├── tokens/
│   │   ├── tx-signature-request/
│   │   └── validator/
│   ├── data/
│   │   ├── data-providers/http/   # apisauce/axios wrapper (IHttpDataProvider)
│   │   ├── dto/                   # API → domain entity mappers
│   │   └── repositories/          # Concrete repository implementations
│   ├── utils/                  # Shared helpers (crypto, date, address, deploy, casperSdk, logger, …)
│   └── typings/                # Ambient type declarations
├── scripts/                    # Tooling (e.g. fixture generation)
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
└── LICENSE
```

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) and the [Code of Conduct](./CODE_OF_CONDUCT.md) before opening an issue or pull request.

A quick checklist before submitting a PR:

1. Run `yarn code:check` and ensure it passes.
2. Add or update tests for your change.
3. Sign your commits with `git commit -s` (DCO).
4. Keep the change focused — split unrelated work into separate PRs.

## Security

If you discover a security vulnerability, please **do not** open a public issue. Follow the responsible disclosure process documented in [SECURITY.md](./SECURITY.md).

## Community & Support

- 🌐 Website: [casperwallet.io](https://www.casperwallet.io/)
- 📖 User guides: [casperwallet.io/user-guide](https://www.casperwallet.io/user-guide)
- ❓ FAQ: [casperwallet.io/faq](https://www.casperwallet.io/faq)
- 💬 Telegram (users): [t.me/CSPRhub](https://t.me/CSPRhub)
- 👩‍💻 Telegram (developers): [t.me/CSPRDevelopers](https://t.me/CSPRDevelopers)
- 🗣️ Forum: [Casper Network — Ecosystem Support](https://forum.casper.network/c/ecosystem-support/7)

## License

Licensed under the [Apache License 2.0](./LICENSE). © MAKE Software and Casper Wallet Core contributors.
