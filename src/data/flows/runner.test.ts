import { Subject, firstValueFrom, tap, toArray } from 'rxjs';

import { createFlowHandle } from './runner';

type Event = { type: string; error?: unknown };

const makeHandle = (
  generator: (signal: AbortSignal) => AsyncGenerator<Event>,
  sideEvents$?: Subject<Event>,
) =>
  createFlowHandle<Event, { status: string; error?: unknown }>({
    id: 'flow-1',
    generator,
    sideEvents$,
    toFailureEvent: error => ({ type: 'failed', error }),
    toResult: events => {
      const failed = events.find(e => e.type === 'failed');

      return failed ? { status: 'failed', error: failed.error } : { status: 'success' };
    },
  });

describe('createFlowHandle', () => {
  it('turns a throw out of the generator into the flow’s last event', async () => {
    const boom = new Error('boom');
    const errored = jest.fn();
    const handle = makeHandle(async function* () {
      yield { type: 'started' };

      throw boom;
    });

    const events = await firstValueFrom(handle.events$.pipe(toArray(), tap({ error: errored })));

    expect(events).toEqual([{ type: 'started' }, { type: 'failed', error: boom }]);
    expect(errored).not.toHaveBeenCalled();
  });

  it('resolves done for a generator that throws before its first yield', async () => {
    const handle = makeHandle(async function* () {
      throw new Error('pre-flight');
    });

    await expect(handle.done).resolves.toMatchObject({ status: 'failed' });
  });

  it('replays the converted failure to a late subscriber', async () => {
    const handle = makeHandle(async function* () {
      throw new Error('boom');
    });

    await handle.done;

    await expect(firstValueFrom(handle.events$.pipe(toArray()))).resolves.toEqual([
      { type: 'failed', error: expect.any(Error) },
    ]);
  });
});
