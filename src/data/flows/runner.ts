import {
  catchError,
  from,
  merge,
  of,
  shareReplay,
  toArray,
  firstValueFrom,
  takeUntil,
  Subject,
} from 'rxjs';
import type { Observable } from 'rxjs';

import type { IFlowHandle } from '../../domain/flows';

export interface ICreateFlowHandleParams<TEvent, TResult> {
  id: string;
  /** The flow itself. Receives the abort signal for explicit cancellation. */
  generator: (signal: AbortSignal) => AsyncGenerator<TEvent>;
  /** Merged into the event stream; stops when the flow completes. */
  sideEvents$?: Observable<TEvent>;
  /** Terminal event for a throw the generator did not turn into an event itself. */
  toFailureEvent: (error: unknown) => TEvent;
  /** Folds the full event sequence into the flow's terminal result. */
  toResult: (events: TEvent[]) => TResult;
}

/**
 * Lifts a flow generator into a hot, replayed handle.
 *
 * The flow starts once and runs regardless of who is subscribed; a later subscriber replays the
 * whole history. Unsubscribing never cancels — only `cancel()` does. A throw out of the generator
 * becomes `toFailureEvent(error)`, so `events$` never errors and `done` always resolves.
 */
export const createFlowHandle = <TEvent, TResult>({
  id,
  generator,
  sideEvents$,
  toFailureEvent,
  toResult,
}: ICreateFlowHandleParams<TEvent, TResult>): IFlowHandle<TEvent, TResult> => {
  const controller = new AbortController();
  const finished$ = new Subject<void>();

  // `done` is derived from this stream alone, never from the merged `events$`: with a live
  // `sideEvents$` that never completes on its own, `events$` would only complete once `finished$`
  // fires, and `finished$` only fires once `done` settles.
  const flow$ = from(generator(controller.signal)).pipe(
    catchError((error: unknown) => of(toFailureEvent(error))),
    shareReplay({ bufferSize: Infinity, refCount: false }),
  );

  const events$ = (sideEvents$ ? merge(flow$, sideEvents$.pipe(takeUntil(finished$))) : flow$).pipe(
    shareReplay({ bufferSize: Infinity, refCount: false }),
  );

  // Subscribing here is what makes both streams hot: the flow runs and side events land in the
  // replay buffer whether or not anyone else is listening.
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
