import { from, merge, shareReplay, toArray, firstValueFrom, takeUntil, Subject } from 'rxjs';
import type { Observable } from 'rxjs';

import type { IFlowHandle } from '../../domain/flows';

export interface ICreateFlowHandleParams<TEvent, TResult> {
  id: string;
  /** The flow itself. Receives the abort signal for explicit cancellation. */
  generator: (signal: AbortSignal) => AsyncGenerator<TEvent>;
  /** Merged into the event stream; stops when the flow completes. */
  sideEvents$?: Observable<TEvent>;
  /** Folds the full event sequence into the flow's terminal result. */
  toResult: (events: TEvent[]) => TResult;
}

/**
 * Lifts a flow generator into a hot, replayed handle.
 *
 * `shareReplay({ bufferSize: Infinity, refCount: false })` is the contract: the flow starts once
 * and keeps running regardless of who is subscribed, and any later subscriber replays the whole
 * history. Unsubscribing must never cancel — only `cancel()` does.
 */
export const createFlowHandle = <TEvent, TResult>({
  id,
  generator,
  sideEvents$,
  toResult,
}: ICreateFlowHandleParams<TEvent, TResult>): IFlowHandle<TEvent, TResult> => {
  const controller = new AbortController();
  const finished$ = new Subject<void>();

  // Hot and replayed on its own: `done` is derived from this alone, never from `events$`. Basing
  // `done` on the merged `events$` below would deadlock whenever `sideEvents$` is a live stream
  // that never completes on its own — `events$` would then only complete once `finished$` fires,
  // and `finished$` only fires once `events$` completes.
  const flow$ = from(generator(controller.signal)).pipe(
    shareReplay({ bufferSize: Infinity, refCount: false }),
  );

  const events$ = (sideEvents$ ? merge(flow$, sideEvents$.pipe(takeUntil(finished$))) : flow$).pipe(
    shareReplay({ bufferSize: Infinity, refCount: false }),
  );

  // Subscribing here is what makes both streams hot: the flow runs, and side events start being
  // captured into `events$`'s replay buffer, whether or not anyone else is listening — the whole
  // point of D4.
  events$.subscribe({ error: () => undefined });

  const done = firstValueFrom(flow$.pipe(toArray()), { defaultValue: [] as TEvent[] })
    .then(toResult)
    .finally(() => finished$.next());

  return {
    id,
    events$,
    done,
    cancel: () => controller.abort(),
  };
};
