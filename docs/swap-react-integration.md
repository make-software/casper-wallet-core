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

Wrap your app (or the subtree that needs swap/wrap) in a `QueryClientProvider` — the hooks in
`src/react/hooks/api` and `src/react/hooks/token` are all built on `@tanstack/react-query`.

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
  getProxyWasm?: () => Promise<Uint8Array>; // required for swap and wrap/unwrap builders
}
```

Everything is optional except `getProxyWasm`, which every swap and wrap/unwrap build call
needs (approval does not — it's a direct contract-package call, not proxied).

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
`QueryClientProvider`, for the hooks in `src/react/hooks/api` and `src/react/hooks/token` that
are built on `@tanstack/react-query`:

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

## 3. Implement `ISigner`

The library never signs or submits. Builders (`buildSwapTransaction`, `buildWrapTransaction`,
`buildUnwrapTransaction`, `buildApprovalTransaction`) return an unsigned `IBuiltDexTransaction`
(exactly one of `.transaction` / `.deploy`, selected by the `useTransactionV1` flag you pass
in). Consumers implement `ISigner`:

```ts
export interface ISigner {
  readonly publicKey: string;
  /** true when the wallet provider supports signing TransactionV1 ('sign-transactionv1'). */
  readonly supportsTransactionV1: boolean;
  send(built: IBuiltDexTransaction, callbacks: ITransactionCallbacks): Promise<void>;
}

export interface ITransactionCallbacks {
  onSent?: (transactionHash: string) => void;
  onProcessed?: () => void;
  onError?: (error: unknown) => void;
  onCancelled?: () => void;
}
```

### Example: CSPR.click adapter

This maps CSPR.click's `send(payload, publicKey, statusUpdate)` status callback onto
`ITransactionCallbacks`:

```ts
const csprClickSigner = (
  clickRef: ICSPRClickSDK,
  publicKey: string,
  supportsTransactionV1: boolean,
): ISigner => ({
  publicKey,
  supportsTransactionV1,
  async send({ transaction, deploy }, callbacks) {
    const isDeploy = Boolean(deploy);
    const built = deploy ?? transaction!;

    const statusUpdate = (status: string, data: SendResult) => {
      if (status === 'sent') {
        const hash = isDeploy ? data?.deployHash : data?.transactionHash;
        if (hash) callbacks.onSent?.(hash);
      }
      if (status === 'processed') {
        if (data?.error || data?.errorData) {
          callbacks.onError?.(data.error || data.errorData);
        } else {
          callbacks.onProcessed?.();
        }
      }
      if (status === 'expired')
        callbacks.onError?.({ message: 'Transaction expired (TTL elapsed)' });
      if (status === 'timeout') callbacks.onError?.({ message: 'Transaction monitoring timeout' });
      if (status === 'error') {
        callbacks.onError?.(
          data?.error || data?.errorData || { message: 'Unexpected error occurred' },
        );
      }
    };

    const jsonPayload = isDeploy
      ? JSON.stringify(Deploy.toJSON(built as Deploy))
      : JSON.stringify({ transaction: { Version1: (built as Transaction).toJSON() } });

    const res = await clickRef.send(jsonPayload, publicKey, statusUpdate);

    if (res?.cancelled) {
      callbacks.onCancelled?.();
      return;
    }
    if (res?.error) {
      callbacks.onError?.(res.error);
    }
  },
});
```

`supportsTransactionV1` for CSPR.click is
`clickRef.getActiveAccount()?.['providerSupports']?.includes('sign-transactionv1')`.

### Extension / mobile signing pipelines

The shape is identical for any signing backend — the extension's in-process keyring and the
mobile app's native signing bridge both implement `ISigner` the same way: build the unsigned
`Transaction`/`Deploy` (already done by the library), sign + submit it through your own
pipeline, and translate its own progress notifications into the four `ITransactionCallbacks`.
Neither needs the CSPR.click-specific JSON envelope — only the observed transaction/deploy hash
lifecycle: submitted (`onSent`), confirmed (`onProcessed`), rejected by the user
(`onCancelled`), or failed (`onError`).

## 4. Slippage and deadline

The library keeps no settings state of its own. `slippage` (percent) and `deadline` (minutes)
are required parameters of `useSwapTokens`, `useSwapTransaction`, and `useReviewSwap` — where
that state lives (in-memory, `localStorage`, `AsyncStorage`, redux-persist, ...) and how it
survives a remount is entirely up to the host app.

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
state with. Clamping is the consumer's call — the hooks take whatever `slippage`/`deadline`
number they're given, unclamped.

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
      amountRaw: rest.getRawTokenBalance('first'),
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

- `src/react/types.ts` — the full `ISigner`, `ITransactionCallbacks`, and `ISwapDependencies`
  contracts.
- `src/domain/swap/`, `src/domain/dex/` — entities, repository interfaces, errors.
- `src/domain/constants/config.ts` — fee/slippage/deadline constants and DEX gas amounts;
  `src/domain/constants/casperNetwork.ts` — the per-network trade API url and contract package
  hashes.
- `src/react/hooks/` — `ui/` (debounce, modal state, transaction status tracking), `api/`
  (TanStack Query hooks over `swapRepository`/`dexContractRepository`), `token/` (balance,
  approval, pair-state helpers shared by swap and wrap), `swap/`, `wrap/` (the two page-level
  flows).
