# Security Policy

The CasperWalletCore maintainers take security seriously. This library is used by both the **Casper Wallet** browser extension and the **Casper Wallet** mobile app, so vulnerabilities here can affect end-user funds. Please report responsibly.

## Supported versions

Only the latest minor release line of CasperWalletCore receives security patches. Older versions are not actively maintained.

| Version  | Supported          |
| -------- | ------------------ |
| `1.2.x`  | :white_check_mark: |
| `< 1.2`  | :x:                |

If you are vendoring an older version, please update to the latest `1.2.x` release before reporting; the issue may already be fixed.

## Reporting a vulnerability

**Please do not file public GitHub issues for security problems.** Use one of the private channels below:

1. **GitHub private vulnerability reports** (preferred): <https://github.com/make-software/casper-wallet-core/security/advisories/new>
2. **Email:** [security@make.software](mailto:security@make.software)

Include in your report:

- A clear description of the vulnerability and its impact.
- Step-by-step reproduction (PoC code, network calls, transactions, configuration).
- Affected version(s) and commit SHA if known.
- Any suggested mitigation or patch.
- Your name and contact details for follow-up and (optional) credit in the advisory.

If your report is sensitive enough to require encryption, request a PGP key in your first message and we will share one.

## Disclosure process & timeline

- **Acknowledgement:** within **3 business days** of receipt.
- **Initial assessment:** within **7 business days** — we will confirm whether the report is in scope, set a severity, and share an expected fix timeline.
- **Fix target:**
  - Critical / High: **30 days**
  - Medium: **60 days**
  - Low: best-effort, typically the next release
- **Coordinated disclosure:** we publish a GitHub Security Advisory and credit the reporter (unless they prefer to remain anonymous) once a fix is released and downstream consumers (Casper Wallet extension and mobile app) have shipped patched builds. We aim to publish the advisory **within 90 days** of receiving the original report, even if a fix is not yet released, unless extending the embargo is necessary to protect users.

Please **do not disclose the issue publicly** (including blog posts, conference talks, or social media) until we have coordinated a release date with you.

## Scope

**In scope** — vulnerabilities in this repository (`CasperWalletCore`):

- Cryptographic flaws in `src/utils/crypto.ts`, signature handling, key derivation.
- Logic bugs in transaction parsing, signing-request validation (`src/utils/signatureRequest.ts`, `src/data/dto/txSignatureRequest/`), or DTO mapping that could lead to fund loss, incorrect balances, or misleading UI.
- HTTP-transport issues that could enable response tampering, SSRF via the `HttpDataProvider`, or credential leakage.
- Decimal/precision bugs in financial math (`decimal.js` usage) leading to incorrect amounts.
- Dependency vulnerabilities directly exploitable through this library's public API.

**Out of scope** — please report these to the respective project:

- The Casper Wallet browser extension → <https://github.com/make-software/casper-wallet>
- The Casper Wallet mobile app → its own repository
- `casper-js-sdk` → <https://github.com/casper-ecosystem/casper-js-sdk>
- The Casper Wallet backend API and infrastructure
- The Casper Network itself / node software / consensus
- Social engineering, phishing, or attacks on Casper Wallet users that do not exploit code in this repository
- Findings from automated scanners without a working proof-of-concept

## Safe harbor

We will not pursue legal action or notify law enforcement against researchers who:

- Make a good-faith effort to comply with this policy.
- Avoid privacy violations, destruction of data, or interruption / degradation of our services.
- Do **not** exploit the vulnerability beyond what is necessary to demonstrate it (no exfiltration of user data, no withdrawing funds, no pivoting into other systems).
- Give us a reasonable opportunity to remediate before public disclosure.

Activities conducted in line with this policy are considered authorised security research, and we will work with you to understand and resolve the issue.

## Recognition

We are happy to publicly credit researchers who report valid vulnerabilities (in the advisory, release notes, or a dedicated thanks file) — let us know how you would like to be credited. CasperWalletCore does not currently operate a paid bug-bounty programme.
