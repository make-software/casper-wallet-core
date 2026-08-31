import { map } from 'rxjs';
import { v4 as uuid } from 'uuid';

import { createFlowHandle } from './runner';

import { isLedgerSignatureCancelled } from '../../domain/ledger';

import type {
  IBuiltDexTransaction,
  IStartWrapFlowParams,
  IWrapFlowHandle,
  IWrapFlowResult,
  IWrapFlowRunner,
  WrapFlowEvent,
} from '../../domain';
import type { ISwapFlowDeps } from './swapFlow';

/** The same dependency set as the swap flow; wrap simply never uses the approval builders. */
export type IWrapFlowDeps = ISwapFlowDeps;

/**
 * The single-leg wrap/unwrap sequence: build, sign, submit, then optionally wait for settlement.
 * Unlike the swap flow there is no approval leg — wrapping spends native CSPR and unwrapping
 * burns the caller's own WCSPR.
 */
const runWrap = async function* (
  deps: IWrapFlowDeps,
  { direction, rawAmount, awaitSettlement = true }: IStartWrapFlowParams,
  signal: AbortSignal,
): AsyncGenerator<WrapFlowEvent> {
  if (signal.aborted) {
    yield { type: 'cancelled' };

    return;
  }

  yield { type: 'wrap:signing' };

  let built: IBuiltDexTransaction;
  let hash: string;

  try {
    built =
      direction === 'wrap'
        ? await deps.dexContractRepository.buildWrapTransaction({
            network: deps.network,
            publicKey: deps.publicKey,
            motesAmount: rawAmount,
            useTransactionV1: deps.supportsTransactionV1,
          })
        : await deps.dexContractRepository.buildUnwrapTransaction({
            network: deps.network,
            publicKey: deps.publicKey,
            rawAmount,
            useTransactionV1: deps.supportsTransactionV1,
          });

    if (signal.aborted) {
      yield { type: 'cancelled' };

      return;
    }

    hash = await deps.casperTransactionsRepository.sendDexTransaction({
      built,
      network: deps.network,
      signer: deps.signer,
    });
  } catch (error) {
    yield (deps.isCancellationError ?? isLedgerSignatureCancelled)(error)
      ? { type: 'cancelled' }
      : { type: 'failed', error };

    return;
  }

  if (signal.aborted) {
    yield { type: 'cancelled' };

    return;
  }

  yield { type: 'wrap:sent', hash };

  if (!awaitSettlement) {
    return;
  }

  let outcome: Awaited<ReturnType<typeof deps.transactionStatusRepository.waitForTransaction>>;

  try {
    outcome = await deps.transactionStatusRepository.waitForTransaction({
      hash,
      network: deps.network,
      isDeploy: built.deploy !== undefined,
      signal,
    });
  } catch (error) {
    yield signal.aborted ? { type: 'cancelled' } : { type: 'failed', error };

    return;
  }

  if (signal.aborted) {
    yield { type: 'cancelled' };

    return;
  }

  if (outcome.status === 'failure') {
    yield {
      type: 'failed',
      error: new Error(`Transaction failed: ${outcome.errorMessage ?? 'unknown reason'}`),
    };

    return;
  }

  yield { type: 'wrap:confirmed', outcome };
};

const toResult = (events: WrapFlowEvent[]): IWrapFlowResult => {
  const result: IWrapFlowResult = { status: 'success' };

  for (const event of events) {
    switch (event.type) {
      case 'wrap:sent':
        result.wrapHash = event.hash;
        break;
      case 'wrap:confirmed':
        result.outcome = event.outcome;
        break;
      case 'failed':
        result.status = 'failed';
        result.error = event.error;
        break;
      case 'cancelled':
        result.status = 'cancelled';
        break;
      default:
        break;
    }
  }

  return result;
};

/** Builds the single-leg wrap/unwrap flow as a hot, replayed handle per {@link IStartWrapFlowParams}. */
export const createWrapFlowRunner = (deps: IWrapFlowDeps): IWrapFlowRunner => {
  const active = new Map<string, IWrapFlowHandle>();

  return {
    publicKey: deps.publicKey,

    start(params: IStartWrapFlowParams): IWrapFlowHandle {
      const id = uuid();

      const handle = createFlowHandle<WrapFlowEvent, IWrapFlowResult>({
        id,
        generator: signal => runWrap(deps, params, signal),
        toFailureEvent: (error): WrapFlowEvent => ({ type: 'failed', error }),
        sideEvents$: deps.ledgerEvents$?.pipe(
          map((event): WrapFlowEvent => ({ type: 'ledger', event })),
        ),
        toResult,
      });

      active.set(id, handle);
      handle.done.finally(() => active.delete(id)).catch(() => undefined);

      return handle;
    },
    getActive: (id: string): IWrapFlowHandle | null => active.get(id) ?? null,
  };
};
