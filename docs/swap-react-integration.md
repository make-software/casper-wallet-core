# Swap / DEX React integration guide

This guide is for consumers wiring the swap and WCSPR wrap/unwrap flows into a React app (the
Casper Wallet browser extension and the mobile app). It covers the pieces added under
`src/domain/swap`, `src/domain/dex`, and the optional React hooks layer in `src/react/`.

`src/react/` is **not** exported from the package root — it depends on `react` and
`@tanstack/react-query`, both optional peer dependencies, so importing it never forces the SDK
or React onto a consumer that only needs the data layer. Import it by its deep path:

```ts
import { useSwapTokens, type ISwapDependencies } from 'casper-wallet-core/src/react';
```

## Install

The package is consumed directly from Git — there is no npm release:

```bash
yarn add github:make-software/casper-wallet-core
```

To use `src/react/`, also install the peer dependencies it expects (already declared as
optional peers in the package's `package.json`, so `yarn`/`npm` won't install them for you):

```bash
yarn add react@^18 @tanstack/react-query@^5
```

Wrap your app (or the subtree that needs swap/wrap) in a `QueryClientProvider` — every exported
hook that fetches is built on `@tanstack/react-query`.

## 1. Call `setupRepositories`

`setupRepositories()` from the package root wires the whole library, including the two new
repositories:

```ts
import { setupRepositories, CasperNetwork } from 'casper-wallet-core';

const { swapRepository, dexContractRepository, tokensRepository } = setupRepositories({
  dexConfig: {
    // All fields optional; shipped defaults cover mainnet/testnet.
    getProxyWasm: () => loadProxyCallerWasm(), // see "Supplying the proxy WASM" below
  },
});
```

- `swapRepository` (`ISwapRepository`) is HTTP-only and SDK-free — quotes and DEX token
  listings, from the trade API.
- `tokensRepository` (`ITokensRepository`) is HTTP-only and SDK-free — every balance and fiat
  rate the swap UI shows, from the same wallet API that backs the wallet's own token list.
- `dexContractRepository` (`IDexContractRepository`) links `casper-js-sdk` — allowance reads,
  the latest block time, and the four unsigned-transaction builders (`buildApprovalTransaction`,
  `buildSwapTransaction`, `buildWrapTransaction`, `buildUnwrapTransaction`). Balances never go
  through it: every balance in the library is read from the API.

If your app already splits `setupDataRepositories()` / `setupSigningRepositories()` to keep the
SDK out of a balances-only bundle, `swapRepository` and `tokensRepository` come back from
`setupDataRepositories()` and `dexContractRepository` from `setupSigningRepositories({ dexConfig, ... })`
— `dexConfig` moved there, alongside the SDK-linked half.

### `IDexConfig`

```ts
interface IDexConfig {
  tradeContractPackageHash?: Record<CasperNetwork, string>; // default TradeContractPackageHash
  wrappedCsprContractPackageHash?: Record<CasperNetwork, string>; // default WrappedCsprContractPackageHash
  gasPriceTolerance?: number; // default 1
  getProxyWasm: () => Promise<Uint8Array>; // required for swap and wrap/unwrap builders
}
```

Everything is optional except `getProxyWasm`, which every swap and wrap/unwrap build call
needs (approval does not — it's a direct contract-package call, not proxied). `dexConfig`
itself is optional: omit it entirely and `dexContractRepository` still builds approvals, but
swap, wrap and unwrap reject. Supply it and the compiler requires `getProxyWasm`, so the
failure lands at setup rather than at the Confirm button.

### Supplying the proxy WASM

Every swap and wrap/unwrap transaction runs through a WASM proxy (`proxy_caller.wasm`). The
library cannot bundle binary assets, so each platform supplies the bytes itself:

```ts
// Web (Vite/webpack, asset import):
import proxyWasmUrl from './assets/proxy_caller.wasm?url';
const getProxyWasm = async () => new Uint8Array(await (await fetch(proxyWasmUrl)).arrayBuffer());

// React Native (bundled asset + a base64/file read appropriate to your RN setup):
const getProxyWasm = async () => {
  const base64 = await RNFS.readFile(proxyWasmAssetPath, 'base64');
  return Uint8Array.from(Buffer.from(base64, 'base64'));
};
```

## 2. Build the dependency object

Every hook in `src/react/` takes its dependencies as fields on its single object parameter —
there is no context to mount. The only provider still required above the hooks is
`QueryClientProvider`, for every exported hook that fetches. That is all of `src/react/hooks/api`
plus anything reaching them transitively — including the page-level `useSwapTokens` and
`useWrapTokens`, and `useSwapRouteTokens`, which issues its own `useQueries`:

```tsx
import { useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ISwapDependencies } from 'casper-wallet-core/src/react';

const queryClient = new QueryClient();

function TradeScreen() {
  const network = useSelector(selectNetwork);
  const activePublicKey = useSelector(selectActivePublicKey);

  const deps = useMemo<ISwapDependencies>(
    () => ({
      swapRepository,
      dexContractRepository,
      tokensRepository,
      network,
      signer,
      activePublicKey,
    }),
    [network, signer, activePublicKey],
  );

  const swap = useSwapTokens({ ...deps, slippage });
  // ...
}
```

Note that each hook takes only the subset it needs, so spreading a full `ISwapDependencies` is a
convenience, not a requirement — a hook can equally be given its three fields by hand. This
library holds no live wallet-account state itself; `activePublicKey` and `signer` are exactly
what the host app currently has selected.

**Repositories must be stable references.** These hooks put dependency objects in
`useCallback`/`useEffect` dependency arrays, so a dependency that gets a new identity on every
render re-triggers those effects — `useTokenBalances`'s CSPR refetch loops indefinitely if
`tokensRepository` is rebuilt on every render instead of held as a stable singleton. Keep
`swapRepository`, `dexContractRepository`, and `tokensRepository` as module-level singletons
(the way `setupRepositories()` in step 1 already returns them), and memoize the `deps` object
itself, as in the example above.

Above `TradeScreen`, only `QueryClientProvider` is required:

```tsx
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TradeScreen />
    </QueryClientProvider>
  );
}
```

## 3. Provide an `ICasperSigner` and build the transaction sender

The library never signs or submits directly, but it does own the sign+submit pipeline: apps no
longer implement a flow-level port themselves. Builders (`buildSwapTransaction`,
`buildWrapTransaction`, `buildUnwrapTransaction`, `buildApprovalTransaction`) return an unsigned
`IBuiltDexTransaction` (exactly one of `.transaction` / `.deploy`, selected by the
`useTransactionV1` flag you pass in). Consumers supply only a key-level `ICasperSigner`
(`createPrivateKeySigner` for a software key, `createLedgerSigner` for Ledger) and hand it,
together with their own deploy-status monitoring, to `createDexTransactionSender`:

```ts
import {
  createDexTransactionSender,
  createPrivateKeySigner,
  setupRepositories,
} from 'casper-wallet-core';

const { casperTransactionsRepository } = setupRepositories();

const signer = createPrivateKeySigner({ publicKeyHex, secretKeyBase64 });

const dexTransactionSender = createDexTransactionSender({
  signer,
  casperTransactionsRepository,
  network,
  supportsTransactionV1:
    casperNetworkApiVersion.startsWith('2.') && (isSoftwareKey || ledgerSupportsTransactionV1),
  waitForTransaction: (transactionHash, network) =>
    waitForDeployOrTransaction(transactionHash, network), // your own deploy/transaction-status monitoring
  isCancellationError: error => isLedgerSignatureCancelled(error), // optional, default: never
});
```

`createDexTransactionSender` produces the `IDexTransactionSender` the hooks' `signer` field
expects:

```ts
export interface IDexTransactionSender {
  readonly publicKey: string;
  /** true when the signer supports signing TransactionV1 — passed in, not derived here. */
  readonly supportsTransactionV1: boolean;
  /** Signs + submits via `sendDexTransaction`; resolves after submission. */
  send(built: IBuiltDexTransaction, callbacks: ITransactionCallbacks): Promise<void>;
}

export interface ITransactionCallbacks {
  onSent?: (transactionHash: string) => void;
  onProcessed?: () => void;
  onError?: (error: unknown) => void;
  onCancelled?: () => void;
}
```

`send` calls `sendDexTransaction({ built, network, signer })`, fires `onSent(hash)` once
submitted, then resolves — settlement is reported later through `onProcessed`/`onError` as your
injected `waitForTransaction` resolves or rejects. A rejection from `sendDexTransaction` itself
routes to `onCancelled` when `isCancellationError` recognizes it, otherwise to `onError`.

### Example: CSPR.click adapter

CSPR.click only exposes `sign`/`signMessage`, not submission, so it becomes a sign-only
`ICasperSigner` adapter — submission then goes through `casperTransactionsRepository`, not
`click.send`:

```ts
const csprClickSigner = (clickRef: ICSPRClickSDK, publicKeyHex: string): ICasperSigner => ({
  publicKeyHex,
  async signTransaction(tx) {
    const { signature, signatureWithPrefix } = await clickRef.sign(tx, publicKeyHex);
    return { signature, signatureWithPrefix };
  },
  async getSignedTransaction(tx) {
    const { signatureWithPrefix } = await clickRef.sign(tx, publicKeyHex);
    tx.setSignature(signatureWithPrefix);
    return tx;
  },
  async signMessage(message) {
    return clickRef.signMessage(message, publicKeyHex);
  },
});
```

A CSPR.click cancellation surfaces as a rejection from `clickRef.sign`/`signMessage` — recognize
it and pass it as `isCancellationError` to `createDexTransactionSender` so it maps to
`onCancelled` instead of `onError`.

### Extension / mobile signing pipelines

The shape is identical for any signing backend — the extension's in-process keyring and the
mobile app's native signing bridge both implement `ICasperSigner` the same way: sign the
transaction hash (already built by the library) and hand the result back. Submission, node-time
drift, and API-version detection are no longer the app's concern — `createDexTransactionSender`
drives them through `casperTransactionsRepository.sendDexTransaction`.

## 4. Slippage and deadline

The library keeps no settings state of its own. `slippage` (percent) is a required parameter of
`useSwapTokens`, `useSwapTransaction` and `useReviewSwap`; `deadline` (minutes) is a required
parameter of `useSwapTransaction` and `useReviewSwap` only. `useSwapTokens` does **not** thread
`deadline` anywhere — it quotes and validates the form, it does not build the transaction — so
a consumer that stops at the orchestrator never supplies one. Where that state lives (in-memory,
`localStorage`, `AsyncStorage`, redux-persist, ...) and how it survives a remount is entirely up
to the host app.

The library exports the clamp helpers and bounds it used to apply internally, so a consumer can
apply the same limits before persisting or passing a value in:

```ts
import {
  clampSlippageValue,
  clampDeadlineValue,
  DEFAULT_SLIPPAGE,
  DEFAULT_DEADLINE,
  MIN_SLIPPAGE,
  MAX_SLIPPAGE,
  MIN_DEADLINE,
  MAX_DEADLINE,
} from 'casper-wallet-core';
```

`clampSlippageValue`/`clampDeadlineValue` clamp to `MIN_SLIPPAGE`/`MAX_SLIPPAGE` and
`MIN_DEADLINE`/`MAX_DEADLINE` respectively (also falling back to the minimum for `NaN`).
`DEFAULT_SLIPPAGE = 3` and `DEFAULT_DEADLINE = 20` are the values to start a fresh consumer's
state with. The hooks pass whatever `slippage`/`deadline` number they're given straight through,
so clamping for the settings UI is the consumer's call — but `buildSwapTransaction` rejects a
`slippage` outside `[0, MAX_SLIPPAGE]` or a `deadline` outside `[MIN_DEADLINE, MAX_DEADLINE]`
with a `DexError` rather than encoding it. Watch the units: a quote's `recommendedSlippageBps`
is in **basis points**, and `slippage` is in **percent**.

### Warning thresholds (consumer-owned)

`SWAP_PRICE_IMPACT_WARNING_THRESHOLD` (10%) and `HIGH_SLIPPAGE_WARNING_THRESHOLD` (10%) are
exported for a consumer's UI to compare against a quote's `priceImpact` and the configured
`slippage`. The library does not gate on either — `isFormValid` ignores price impact entirely,
so showing (or blocking on) a high-impact warning is the host app's decision.

## Error shape: `SwapError`

Every `ISwapRepository` rejection is a `SwapError` (`domain/swap`), which carries the failed
HTTP response's JSON envelope and status code, not just a message:

```ts
export type ISwapError = IDomainError<SwapErrorType> & {
  data?: string; // JSON envelope of the failed response, when there was one
  status?: number;
};
```

Two hooks build directly on this:

- `useFetchSwapQuote`'s `fetchQuoteErrorCode` parses `error.data` one level down
  (`{ data: { error: { code } } }`) to recover the trade API's `FetchQuoteErrorCodes`
  (`invalid_input` / `not_found`) for quote-specific error UI.
- `useFetchToken`'s `errorMessage` reads `error.status` directly: a `400` maps to `'Pair not
found'`, anything else falls back to `error.message`.

Any consumer writing its own error UI against `swapRepository`/`dexContractRepository` calls
can rely on the same `data`/`status` fields being present on `SwapError`.

## CSPR balance refresh

`useTokenBalances` fetches the native CSPR balance itself, on mount and whenever
`activePublicKey` changes — this library has no live wallet-account state to push balance
updates from. CEP-18 token balances still auto-refresh
every 30 seconds via `useFetchAccountTokenOwnership`'s `refetchInterval`, but the CSPR leg does
not poll. If your flow needs a fresher CSPR balance than "on account switch" (for example,
right after a transaction is confirmed), call the `refetchCsprBalance` function
`useTokenBalances` returns — `useWrapTokens`'s `onWrapSuccess` is the reference example.

## Swap review flow

`useSwapTokens` drives the trade form; `useReviewSwap` drives the review modal that follows it.
The orchestrator hands over the two amounted tokens, the quoted `path` and the `quoteType`, and
`useReviewSwap` runs the CEP-18 approval (skipped for a native CSPR input) before the swap:

```tsx
import { useSwapTokens, useReviewSwap } from 'casper-wallet-core/src/react';

function SwapPage({ slippage, deadline }: { slippage: number; deadline: number }) {
  const deps = useMemo<ISwapDependencies>(/* as in step 2 */);

  const {
    selectedTokens,
    tokenAmounts,
    path,
    quoteType,
    isReviewModalOpen,
    closeReviewModal,
    onSwapSuccess,
    ...rest
  } = useSwapTokens({ ...deps, slippage });

  const { step, transactionState, isProcessing, confirmSwap, transactionHash } = useReviewSwap({
    ...deps,
    slippage,
    deadline,
    firstToken: { ...selectedTokens.first!, ...tokenAmounts.first },
    secondToken: { ...selectedTokens.second!, ...tokenAmounts.second },
    path,
    quoteType,
    isOpen: isReviewModalOpen,
    onSwapSuccess,
    onClose: closeReviewModal,
  });

  // ...render form + review modal using the above
}
```

`firstToken`/`secondToken` carry the **transaction** amounts (`tokenAmounts.first.raw` is the
raw amount the user typed, not their balance). `slippage` must be the same value passed to
`useSwapTokens`, so the quote the user saw and the bound encoded into the payload agree; the
approval amount is derived from it and needs nothing else from the caller.

`path` must come from the quote for the pair currently selected — `buildSwapTransaction`
rejects a route whose first hop is not the input token or whose last hop is not the output
token, since `amount_out_min` bounds how much the user receives but not which token it is.

## Wrap / unwrap flow

WCSPR wrap/unwrap composes the same building blocks as swap, with no approval step (`withdraw`
burns the caller's own WCSPR balance) and no slippage/deadline:

```tsx
import { useWrapTokens, useReviewWrap } from 'casper-wallet-core/src/react';

function WrapPage() {
  const deps = useMemo<ISwapDependencies>(
    () => ({
      swapRepository,
      dexContractRepository,
      tokensRepository,
      network,
      signer,
      activePublicKey,
    }),
    [network, signer, activePublicKey],
  );

  const {
    direction,
    amount,
    sourceToken,
    destinationToken,
    sourceRawAmount,
    isFormValid,
    isReviewModalOpen,
    openReviewModal,
    closeReviewModal,
    updateAmount,
    switchDirection,
    onWrapSuccess,
    ...rest
  } = useWrapTokens(deps);

  const { step, status, error, confirmWrap, handleCloseSuccessModal } = useReviewWrap({
    ...deps,
    direction,
    sourceToken: {
      ...sourceToken,
      amountFormatted: amount,
      // The transaction amount, not the balance: this is what lands in the on-chain
      // `amount` / `attached_value` arg.
      amountRaw: sourceRawAmount,
    },
    isOpen: isReviewModalOpen,
    onWrapSuccess,
    onClose: closeReviewModal,
  });

  // ...render form + review modal using the above
}
```

- `useWrapTokens` owns the form: direction toggle, amount entry, balance/fee validation
  (`isInsufficientCsprForFees`), and fiat display for the source leg.
- `useReviewWrap` drives the review-modal build+sign step: `confirmWrap` builds via
  `dexContractRepository.buildWrapTransaction`/`buildUnwrapTransaction` (direction-dispatched)
  and hands the result to `signer.send`. Note `onProcessed` fires `onWrapSuccess` immediately
  rather than on modal close, and `onCancelled` maps to the `'error'` status like any other
  failure.

For swap (approval-then-swap, with slippage/deadline as consumer-owned parameters — see
"Slippage and deadline" above), the equivalent entry points are `useSwapTokens` (form
orchestration) and `useReviewSwap` (review modal, approval + swap).

Every hook shown in this guide takes a single object parameter whose dependency fields
(`network`, `activePublicKey`, `swapRepository`, `dexContractRepository`, `tokensRepository`,
`signer`) are required — there is no default or optional fallback for them, and each hook's
params type `Pick`s only the subset it needs from `ISwapDependencies`.

## Further reading

- `src/domain/dex/entities.ts` — the full `IDexTransactionSender` and `ITransactionCallbacks`
  contracts (re-exported from `src/react/types.ts`); `src/data/signers/dexTransactionSender.ts` —
  `createDexTransactionSender`. `src/react/types.ts` — `ISwapDependencies`.
- `src/domain/swap/`, `src/domain/dex/` — entities, repository interfaces, errors.
- `src/domain/constants/config.ts` — fee/slippage/deadline constants and DEX gas amounts;
  `src/domain/constants/casperNetwork.ts` — the per-network trade API url and contract package
  hashes.
- `src/react/hooks/` — `ui/` (debounce, modal state, transaction status tracking), `api/`
  (TanStack Query hooks over `swapRepository`/`dexContractRepository`), `token/` (balance,
  approval, pair-state helpers shared by swap and wrap), `swap/`, `wrap/` (the two page-level
  flows).
