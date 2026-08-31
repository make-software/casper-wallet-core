# Swap / DEX React integration guide

This guide is for consumers wiring the swap and WCSPR wrap/unwrap flows into a React app (the
Casper Wallet browser extension and the mobile app). It covers the pieces added under
`src/domain/swap`, `src/domain/dex`, `src/domain/flows`/`src/data/flows` (the framework-neutral
flow layer, root-exported), and the optional React hooks layer in `src/react/`.

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
  gasPriceTolerance?: number; // default 1
  getProxyWasm: () => Promise<Uint8Array>; // required for swap and wrap/unwrap builders
  expectedProxyWasmSha256?: string; // strongly recommended, see below
}
```

Everything is optional except `getProxyWasm`, which every swap and wrap/unwrap build call
needs (approval does not — it's a direct contract-package call, not proxied). `dexConfig`
itself is optional: omit it entirely and `dexContractRepository` still builds approvals, but
swap, wrap and unwrap reject. Supply it and the compiler requires `getProxyWasm`, so the
failure lands at setup rather than at the Confirm button.

The wrapped-CSPR contract package hash is **not** part of `dexConfig`. `swapRepository` keys its
synthetic native-CSPR token off the same address, so it is one parameter of the setup factories
(`setupRepositories({ wrappedCsprContractPackageHash })`) rather than two knobs that can
disagree — a divergence rejects every native-CSPR swap as an invalid route.

A network whose `tradeContractPackageHash` or `wrappedCsprContractPackageHash` is empty — which
is the shipped default for devnet and integration — refuses to build rather than signing a call
against a zero-length address. Supply both if you support those networks.

### Supplying the proxy WASM

Every swap and wrap/unwrap transaction runs through a WASM proxy (`proxy_caller.wasm`). The
library cannot bundle binary assets, so each platform supplies the bytes itself:

```ts
// Web (Vite/webpack — inline the bytes at build time, do not fetch them at runtime):
import proxyWasm from './assets/proxy_caller.wasm';
const getProxyWasm = async () => new Uint8Array(proxyWasm);

// React Native (bundled asset + a base64/file read appropriate to your RN setup):
const getProxyWasm = async () => {
  const base64 = await RNFS.readFile(proxyWasmAssetPath, 'base64');
  return Uint8Array.from(Buffer.from(base64, 'base64'));
};
```

**Ship the bytes as a build-time asset, and set `expectedProxyWasmSha256`.** These bytes execute
as session code in the caller's account context, with access to their main purse — it is the most
powerful payload the library builds, and unlike the bounded `approve` call neither the wallet UI
nor the Ledger prompt shows the user more than "ModuleBytes". A runtime `fetch` widens the
exposure from your own asset pipeline to whatever that URL resolves to on the day.

```ts
dexConfig: {
  getProxyWasm,
  // shasum -a 256 proxy_caller.wasm
  expectedProxyWasmSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
}
```

The bytes are hashed once per repository and the build is refused on a mismatch. Without it they
are used as supplied, and nothing downstream can tell a correct binary from a substituted one.

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
      // Built once from a signer + setupRepositories(), as shown in step 3.
      swapFlowRunner,
      wrapFlowRunner,
      activePublicKey,
    }),
    [network, swapFlowRunner, wrapFlowRunner, activePublicKey],
  );

  const swap = useSwapTokens({ ...deps, slippage });
  // ...
}
```

Note that each hook takes only the subset it needs, so spreading a full `ISwapDependencies` is a
convenience, not a requirement — a hook can equally be given its fields by hand. This library
holds no live wallet-account state itself; `activePublicKey`, `swapFlowRunner` and
`wrapFlowRunner` are exactly what the host app currently has selected and built — `null` for the
runners and `activePublicKey` until a wallet is connected.

**Repositories and flow runners must be stable references.** These hooks put dependency objects
in `useCallback`/`useEffect` dependency arrays, so a dependency that gets a new identity on every
render re-triggers those effects — `useTokenBalances`'s CSPR refetch loops indefinitely if
`tokensRepository` is rebuilt on every render instead of held as a stable singleton. A
`swapFlowRunner` rebuilt on every render loses something different: `getActive(id)` is backed by
a map on the runner instance, so every in-flight flow becomes unreachable and a remounted surface
can no longer reattach to a swap that is still running. Keep `swapRepository`,
`dexContractRepository` and `tokensRepository` as module-level (or memoized-once) singletons, and
memoize the `deps` object itself, as in the example above.

**The flow runners are the exception: they are stable per account, not per app.** See step 3.

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

## 3. Provide an `ICasperSigner` and build the flow runners

The library never signs or submits directly, but it does own the whole approve → settle →
swap → settle orchestration: apps no longer implement a flow-level port themselves. Consumers
supply only a key-level `ICasperSigner` (`createPrivateKeySigner` for a software key,
`createLedgerSigner` for Ledger) and hand it, together with the repositories from
`setupRepositories()`, to `createSwapFlowRunner` / `createWrapFlowRunner`:

```ts
import {
  createPrivateKeySigner,
  createSwapFlowRunner,
  createWrapFlowRunner,
  isLedgerSignatureCancelled,
  setupRepositories,
} from 'casper-wallet-core';

const { casperTransactionsRepository, dexContractRepository, transactionStatusRepository } =
  setupRepositories({ dexConfig: { getProxyWasm, expectedProxyWasmSha256 } });

const signer = createPrivateKeySigner({ publicKeyHex, secretKeyBase64 });

const swapFlowRunner = createSwapFlowRunner({
  network,
  publicKey: publicKeyHex,
  signer,
  supportsTransactionV1:
    casperNetworkApiVersion.startsWith('2.') && (isSoftwareKey || ledgerSupportsTransactionV1),
  dexContractRepository,
  casperTransactionsRepository,
  transactionStatusRepository,
  // Optional: device prompts interleave with flow progress in the same stream.
  ledgerEvents$: ledgerService?.ledgerEvents$,
  // Optional: the default already classifies a Ledger `SignatureCanceled` /
  // `MsgSignatureCanceled` as a cancellation. Supply one only for a signer of your own.
  isCancellationError: isLedgerSignatureCancelled,
});
```

`createWrapFlowRunner` takes the identical dependency shape — build both runners from the same
`deps` object (wrap simply never calls the approval builders). `transactionStatusRepository`
(`ITransactionStatusRepository`) is core-owned: it polls node RPC until the submitted
transaction executes, so there is no `waitForTransaction` callback left for a consumer to
implement.

**A runner is bound to the `publicKey` and `signer` it was built with, for its whole lifetime.**
The swap is built from, paid by, signed by and delivered to that key — the `to` recipient is
derived from it, not from anything the surface passes at Confirm time. So **rebuild both runners
when the active account changes**, memoized on `activePublicKey`:

```ts
const { swapFlowRunner, wrapFlowRunner } = useMemo(() => {
  if (!activePublicKey || !signer) return { swapFlowRunner: null, wrapFlowRunner: null };

  const flowDeps = { network, publicKey: activePublicKey, signer, ...repositories };

  return {
    swapFlowRunner: createSwapFlowRunner(flowDeps),
    wrapFlowRunner: createWrapFlowRunner(flowDeps),
  };
}, [activePublicKey, signer, network]);
```

Both runners expose `publicKey`, and `useReviewSwap` / `useReviewWrap` refuse to start a flow when
it disagrees with `activePublicKey`, surfacing a `FlowError` rather than signing for the wrong
account. That is a backstop, not the mechanism: rebuild the runners.

Rebuilding drops the previous runner's `getActive` map, so do it on account change only — not on
every render.

`runner.start(params)` returns an `ISwapFlowHandle` / `IWrapFlowHandle` — a running flow, not a
one-shot promise. `src/react/hooks/swap/useReviewSwap.ts` and
`src/react/hooks/wrap/useReviewWrap.ts` are the reference subscribers (see "Swap review flow" and
"Wrap / unwrap flow" below); a non-React consumer subscribes to `handle.events$` the same way.

### The flow handle and cancellation semantics

- **`events$` is hot and replayed.** It is a `shareReplay({ bufferSize: Infinity, refCount:
false })` observable: the flow starts as soon as `start()` is called, regardless of whether
  anyone is subscribed, and a subscriber that attaches later — after a modal reopens, or a
  screen remounts — receives the full event history from the beginning, not just what happens
  next.
- **Unsubscribing never cancels the flow.** Closing a review modal or navigating away
  unsubscribes the hook's listener, but the submitted transaction keeps running to completion.
  This is deliberate: a closed UI surface must not abandon a swap or wrap that is already on
  chain.
- **`handle.cancel()` is the only way to stop a flow**, and only takes effect at the next
  `AbortSignal` check inside the flow generator — it cannot un-submit a transaction that has
  already been sent.
- **Reattaching:** `runner.getActive(id)` returns the handle for a still-running flow by its
  `id`, or `null` once it has finished. A surface that unmounted and remounted (a modal closed
  and reopened, an app backgrounded and resumed) uses this to pick the same in-flight flow back
  up instead of losing track of it or starting a duplicate.

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
it and pass it as `isCancellationError` to `createSwapFlowRunner`/`createWrapFlowRunner` so the
flow yields a `'cancelled'` event (reducer state `'idle'`) instead of a `'failed'` one.

### Extension / mobile signing pipelines

The shape is identical for any signing backend — the extension's in-process keyring and the
mobile app's native signing bridge both implement `ICasperSigner` the same way: sign the
transaction hash (already built by the library) and hand the result back. Submission, node-time
drift, and API-version detection are no longer the app's concern — the flow runner drives them
through `casperTransactionsRepository.sendDexTransaction` and `transactionStatusRepository`.

## 4. Slippage and deadline

The library keeps no settings state of its own. `slippage` (percent) is a required parameter of
`useSwapTokens` and `useReviewSwap`; `deadline` (minutes) is a required parameter of
`useReviewSwap` only, which threads both into the swap flow's `IStartSwapFlowParams`.
`useSwapTokens` does **not** thread `deadline` anywhere — it quotes and validates the form, it
does not build the transaction — so a consumer that stops at the orchestrator never supplies
one. Where that state lives (in-memory,
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
The orchestrator hands over one `quotedTrade` bundle — the two amounted tokens, the route and the
quote type, all read off the same quote — and `useReviewSwap` runs the CEP-18 approval (skipped
for a native CSPR input) before the swap:

```tsx
import { useSwapTokens, useReviewSwap } from 'casper-wallet-core/src/react';

function SwapPage({ slippage, deadline }: { slippage: number; deadline: number }) {
  const deps = useMemo<ISwapDependencies>(/* as in step 2 */);

  const {
    selectedTokens,
    tokenAmounts,
    quotedTrade,
    isReviewModalOpen,
    closeReviewModal,
    onSwapSuccess,
    ...rest
  } = useSwapTokens({ ...deps, slippage });

  const {
    step,
    transactionState,
    isProcessing,
    confirmSwap,
    resetForm,
    handleCloseSuccessModal,
    transactionHash,
    ledgerEvent,
  } = useReviewSwap({
    ...deps,
    slippage,
    deadline,
    trade: quotedTrade,
    isOpen: isReviewModalOpen,
    onSwapSuccess,
    onClose: closeReviewModal,
  });

  // ...render form + review modal using the above
}
```

**Pass `quotedTrade` whole; do not assemble the four fields yourself.** They carry the
**transaction** amounts, not balances, and they must all come from one quote: `amount_out_min` is
derived from `secondToken.amountRaw` and is only a slippage bound on the trade that
`firstToken.amountRaw` and `path` describe. Pairing a fresh input amount with a previous quote's
output is an unprotected fill if the amount grew and a wasted-gas revert if it shrank, and
`buildSwapTransaction` cannot catch it — it validates the route's token _identity_, not its
amounts. `quotedTrade` is `null` whenever no quote is in hand, and `confirmSwap` is a no-op then.

The form's own `tokenAmounts` lag the quote by the input debounce, so they are for rendering, not
for building. `slippage` must be the same value passed to `useSwapTokens`, so the quote the user
saw and the bound encoded into the payload agree; the approval amount is derived from it and
needs nothing else from the caller.

`confirmSwap` calls `swapFlowRunner.start(...)` and subscribes to the resulting handle;
`transactionState` is the reducer's fold of the flow's events into `{ approval, swap }` leg
status, and `ledgerEvent` is the most recent device-prompt event forwarded through
`ledgerEvents$` (`undefined` until one arrives, or if the runner was built without a Ledger
stream).

Closing the modal (`isOpen: false`) unsubscribes the hook from `events$`, which stops it from
applying further events but never cancels the underlying flow: a submitted swap keeps running.
Reopening the modal resubscribes, replays the flow's full history through the reducer, and
reconstructs the true current state rather than a reset form. See "The flow handle and
cancellation semantics" in step 3.

### The allowance a swap leaves behind

A CEP-18 swap approves a bounded amount derived from the trade — never an infinite allowance —
but whatever the swap did not spend stays granted afterwards, including after one that reverted
on chain. Read the standing amount with `dexContractRepository.getAllowance(...)`, and build a
revocation with `dexContractRepository.buildRevokeApprovalTransaction(...)` (an `approve` of `0`,
submitted the same way as any other build).

Nothing revokes automatically. It is a third signature, confirmation and payment on top of the
swap, it cannot run on the paths where signing itself failed, and it throws away the saving of a
still-sufficient allowance on the user's next swap of the same token. Whether to offer it — and
whether to surface a standing allowance at all — is the surface's call.

### Retrying, and `resetForm`

A flow that fails or is cancelled leaves `step` at `'confirm'` with the error in
`transactionState`, and **pressing Confirm again starts a new flow** — the hook's guard is
released when the flow settles, not when the surface asks. You do not need `resetForm` to retry,
and calling it would clear the error message the user is reading.

`resetForm` clears the hook's local state, and **refuses to do anything while a flow is still
live**. That is deliberate: wiring it to a modal's close handler would otherwise let a second
Confirm start a second approval and a second swap against the same balance, which can stay in
flight for the full settlement timeout. It does not cancel a running flow either — stopping one
is `handle.cancel()`, and nothing else.

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
      swapFlowRunner,
      wrapFlowRunner,
      activePublicKey,
    }),
    [network, swapFlowRunner, wrapFlowRunner, activePublicKey],
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

  const { step, status, error, confirmWrap, handleCloseSuccessModal, ledgerEvent } = useReviewWrap({
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
- `useReviewWrap` drives the review-modal build+sign step: `confirmWrap` calls
  `wrapFlowRunner.start({ direction, rawAmount: sourceToken.amountRaw })`, which builds via
  `dexContractRepository.buildWrapTransaction`/`buildUnwrapTransaction` (direction-dispatched)
  and submits through the signer baked into the runner (step 3). `onWrapSuccess` fires as soon
  as the flow's `'wrap:confirmed'` event arrives, not on modal close. A cancelled signature
  resets `status` back to `'idle'` (the `'confirm'` step); a submission or on-chain failure sets
  `status` to `'error'` with a message in `error`. Either way pressing Confirm again starts a new
  flow, the same as swap — there is no reset to call. `ledgerEvent` carries device prompts and
  should be rendered here exactly as on the swap side; without it the modal sits at signing with
  nothing explaining the wait. As with swap, closing the modal unsubscribes but never cancels a
  submitted wrap — see "The flow handle and cancellation semantics" in step 3.

For swap (approval-then-swap, with slippage/deadline as consumer-owned parameters — see
"Slippage and deadline" above), the equivalent entry points are `useSwapTokens` (form
orchestration) and `useReviewSwap` (review modal, approval + swap).

Every hook shown in this guide takes a single object parameter whose dependency fields
(`network`, `activePublicKey`, `swapRepository`, `dexContractRepository`, `tokensRepository`,
`swapFlowRunner`, `wrapFlowRunner`) are required — there is no default or optional fallback for
them, and each hook's params type `Pick`s only the subset it needs from `ISwapDependencies`.

## Further reading

- `src/domain/flows/entities.ts` — `IFlowHandle`, `ISwapFlowRunner`/`IWrapFlowRunner`,
  `SwapFlowEvent`/`WrapFlowEvent`, `ISwapFlowResult`/`IWrapFlowResult` (re-exported from
  `src/domain/index.ts`); `src/data/flows/` — `createSwapFlowRunner`, `createWrapFlowRunner`,
  `createFlowHandle` (root-exported). `src/react/types.ts` — `ISwapDependencies`.
- `src/domain/swap/`, `src/domain/dex/` — entities, repository interfaces, errors.
- `src/domain/transactionStatus/` — `ITransactionStatusRepository`, `ITransactionOutcome`,
  `TransactionTimeoutError`.
- `src/domain/constants/config.ts` — fee/slippage/deadline constants and DEX gas amounts;
  `src/domain/constants/casperNetwork.ts` — the per-network trade API url and contract package
  hashes.
- `src/react/hooks/` — `ui/` (debounce, modal state), `api/` (TanStack Query hooks over
  `swapRepository`/`dexContractRepository`), `token/` (balance, fee validation, pair-state
  helpers shared by swap and wrap), `swap/`, `wrap/` (the page-level form hooks plus
  `useReviewSwap`/`useReviewWrap`, which subscribe to the flow runners in `src/data/flows`).
