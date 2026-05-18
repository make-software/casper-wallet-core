# Contributing to Casper Wallet Core

Thank you for your interest in contributing! This document explains how to report issues, submit changes, and what we look for in a good pull request.

We welcome contributions of all sizes — bug reports, documentation fixes, new features, and reviews.

## Table of contents

- [Submitting issues](#submitting-issues)
- [Development setup](#development-setup)
- [Running tests and checks](#running-tests-and-checks)
- [Code style](#code-style)
- [Commit conventions](#commit-conventions)
- [Pull request workflow](#pull-request-workflow)
- [Adding a new domain module](#adding-a-new-domain-module)
- [Sign your work (DCO)](#sign-your-work-dco)
- [Code of Conduct](#code-of-conduct)
- [Security](#security)

## Submitting issues

Before opening an issue:

- If you have questions about **using the Casper Wallet** itself, check the [User Guides](https://www.casperwallet.io/user-guide) and [FAQ](https://www.casperwallet.io/faq), or [join our community on Telegram](https://t.me/CSPRhub).
- If you have questions about **using CasperWalletCore in your own project**, please re-read the [README](./README.md) first.
- If you want to build CasperWalletCore as a dependency for the Casper Wallet extension or mobile app, head over to their respective repositories — CW Core is already integrated into their build processes; you do not need to build it separately.
- For deeper ecosystem discussion, see:
  - The Ecosystem Support category of the [Casper Network Forum](https://forum.casper.network/c/ecosystem-support/7).
  - The [CSPR Developers Group](https://t.me/CSPRDevelopers) on Telegram.

**For security issues, please do _not_ open a public issue** — follow the [Security Policy](./SECURITY.md).

### Before filing

- **Search existing issues first** — your problem may already be reported or fixed.
- Use the [bug report](./.github/ISSUE_TEMPLATE/bug_report.yml) or [feature request](./.github/ISSUE_TEMPLATE/feature_request.yml) template.
- Include reproduction steps, the library version, Node version, and the Casper network involved.

## Development setup

CasperWalletCore is a TypeScript library — there is no build step and no standalone bundle. Consumers (the Casper Wallet extension and mobile apps) compile from source.

Requirements:

- **Node:** `20` or `>= 22` (a `.nvmrc` is provided — run `nvm use` if you use `nvm`).
- **Package manager:** Yarn 4 (Berry). Yarn is managed via Corepack — enable it once with `corepack enable`.

Clone and install:

```bash
git clone https://github.com/make-software/casper-wallet-core.git
cd casper-wallet-core
corepack enable
yarn install --immutable
```

## Running tests and checks

| Command                  | Purpose                                              |
| ------------------------ | ---------------------------------------------------- |
| `yarn code:check`        | Type-check (`tsc --skipLibCheck --noEmit`) + ESLint  |
| `yarn lint`              | ESLint with `--fix`                                  |
| `yarn test`              | Run the Jest suite                                   |
| `yarn test:watch`        | Run Jest in watch mode                               |
| `yarn test:coverage`     | Generate a coverage report under `coverage/`         |
| `yarn test:integration`  | Run only integration tests (`*.integration.test.ts`) |
| `yarn fixtures:generate` | Regenerate transaction test fixtures (`scripts/`)    |

CI runs `yarn code:check` and `yarn test --ci --coverage` on Node 20 and 22. All checks must be green before a PR can be merged.

A Husky `pre-commit` hook runs `lint-staged` (`eslint --fix` on staged `.ts`/`.tsx` files). The hook is installed automatically by the `prepare` script after `yarn install`.

## Code style

- Single quotes, trailing commas, 2-space indent, 100-character print width.
- Arrow parens omitted: `x => x`, not `(x) => x`.
- Prettier + ESLint enforce the rest — run `yarn lint` to auto-fix what's fixable.

Project-specific patterns to follow:

- **Financial math** — always use `Decimal` from `decimal.js`. Never use native JS numbers for balances, amounts, or prices.
- **HTTP** — all network access must go through `IHttpDataProvider`. Repositories receive it via constructor injection so they remain testable.
- **Error handling** — domain errors implement `IDomainError`. Throw domain errors at the data-layer boundary, not raw HTTP errors.
- **No leaked types** — every public entity exported from `src/domain/<module>/entities.ts` should be re-exported via the package root (`index.ts`).

## Commit conventions

Conventional Commits are encouraged but not strictly enforced:

```
feat(deploys): support CEP-18 entry-point detection
fix(tokens): handle missing CoinGecko price for testnet tokens
chore(deps): bump casper-js-sdk to 5.0.12
docs(readme): clarify setupRepositories options
```

Keep the subject line under ~72 characters and prefer the imperative mood (`add`, not `added` / `adds`).

## Pull request workflow

1. **Open an issue first** for non-trivial changes — alignment on approach saves both sides time.
2. **Fork the repo** and create a feature branch (e.g. `feat/<short-description>` or `fix/<short-description>`).
3. **Keep PRs focused** — split unrelated changes into separate PRs. As a rule of thumb, if your PR touches more than three unrelated areas, split it.
4. **Add or update tests** that cover the change. Bug fixes should include a regression test.
5. **Run `yarn code:check && yarn test`** locally before pushing.
6. **Sign every commit** with `git commit -s` ([DCO](#sign-your-work-dco)).
7. **Open the PR** against `master`. Fill in the [PR template](./.github/PULL_REQUEST_TEMPLATE.md); reference the related issue with `Closes #123`.

### What reviewers look for

- The change does what the title and description claim.
- Tests cover the new behaviour (and any error paths).
- No regressions in the public surface re-exported by `index.ts` (we treat it as semver-relevant).
- Type-safe, no `any` unless justified, no swallowed errors.
- Documentation (`README`, JSDoc on public types) updated if behaviour or surface changed.
- Commit messages are clear and signed-off.

PR conventions:

- **No AI-tool attribution** in PR titles or descriptions.
- **No change-statistics blocks** (file/line counts) — GitHub already shows these.
- Keep descriptions focused on _what changed_ and _why_.

Reviews typically land within a few business days. Ping the PR if it's been idle for more than a week.

## Adding a new domain module

The codebase follows a clean-architecture split between **domain** (interfaces only) and **data** (implementations). Each module typically consists of:

```
src/domain/<module>/
├── entities.ts          # TypeScript interfaces for business objects
├── repository.ts        # Repository contract (interface only)
└── errors.ts            # Domain-specific errors (optional)

src/data/dto/<module>/         # API → domain mapping
src/data/repositories/<module>/ # Concrete repository implementation
```

Step-by-step for a new module called `myModule`:

1. **Define the domain** in `src/domain/myModule/`:
   - `entities.ts` — interfaces describing the business objects.
   - `repository.ts` — the `IMyModuleRepository` interface.
   - Re-export from `src/domain/index.ts`.
2. **Implement the DTOs** in `src/data/dto/myModule/` — pure functions/classes that map raw API responses to the domain entities. Use `Decimal` for any numeric amounts.
3. **Implement the repository** in `src/data/repositories/myModule/`:
   - Inject `IHttpDataProvider` and any URL map (`casperWalletApiByNetworkUrl` / `casperWalletApiByEnvUrl`) via the constructor.
   - Re-export from `src/data/repositories/index.ts`.
4. **Wire it into `src/setup.ts`** — instantiate the repository inside `setupRepositories()` and return it on the result object.
5. **Add tests** alongside the code (`*.test.ts`).
6. **Update the README** repository table.

> ⚠️ **Naming asymmetry to watch out for:** some domain directories use singular/kebab-case while their data counterparts use plural/camelCase (e.g. `domain/validator` ↔ `data/repositories/validators`; `domain/tx-signature-request` ↔ `data/repositories/txSignatureRequest`). When in doubt, follow the pattern of the closest existing module.

## Sign your work (DCO)

All contributions are licensed under the [Apache License 2.0](./LICENSE). We use the [Developer Certificate of Origin](./.github/developer-certificate-of-origin) (DCO) as an additional safeguard — it certifies that you have the right to submit your contribution under the project's license.

To sign off a commit, add a `Signed-off-by:` trailer:

```
Signed-off-by: Random J Developer <random@developer.example.org>
```

If your `user.name` and `user.email` git configs are set correctly, you can sign automatically with:

```bash
git commit -s
```

You can also alias this: `git config --global alias.ci 'commit -s'` — then `git ci` always signs.

Use your real name. Pseudonymous and anonymous contributions cannot be accepted.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you are expected to uphold it. Report unacceptable behaviour to `community@make.services`.

## Security

See the [Security Policy](./SECURITY.md) for how to privately report vulnerabilities. Please **do not** open a public issue for security problems.
