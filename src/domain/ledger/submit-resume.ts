import type { LedgerEventStatus } from './entities';
import { ledgerEventAnswersSubmit } from './errors';

export interface LedgerSubmitResume {
  /**
   * Marks a submit as reaching the device. The returned release settles that invocation and
   * only that one — a resumed submit that short-circuits must not settle the original.
   */
  issued(): () => void;
  /** The user submitted with the device away; resume once it returns. */
  awaitingConnect(): void;
  /** The device left. Re-arms only while a submit is outstanding. */
  deviceLeft(): void;
  /** A device event arrived; settles the submit when the status answers for it. */
  outcomeReported(status: LedgerEventStatus): void;
  /** The caller abandoned the flow. Drops the submit and the arm together. */
  dropped(): void;
  shouldResume(): boolean;
  /** The arm has been spent on a re-issue; the submit itself stays outstanding. */
  resumed(): void;
}

/**
 * Tracks whether a Ledger submit may be re-issued when the device comes back: armed only while
 * one is outstanding, dropped the moment the device answers for it. Outstanding is refcounted,
 * not a flag — a resumed submit overlaps the one it resumes, and a flag would let the
 * short-circuiting resume settle the original early.
 */
export function createLedgerSubmitResume(): LedgerSubmitResume {
  let outstanding = 0;
  let armed = false;
  // Bumped by a drop so a release still held by the abandoned submit cannot decrement the
  // count a later submit is using.
  let generation = 0;

  const clear = (): void => {
    outstanding = 0;
    armed = false;
    generation += 1;
  };

  return {
    issued() {
      const issuedGeneration = generation;
      let released = false;

      outstanding += 1;

      return () => {
        if (released || issuedGeneration !== generation) return;

        released = true;
        outstanding -= 1;
      };
    },

    awaitingConnect() {
      armed = true;
    },

    deviceLeft() {
      if (outstanding > 0) {
        armed = true;
      }
    },

    outcomeReported(status) {
      if (ledgerEventAnswersSubmit(status)) {
        clear();
      }
    },

    dropped: clear,

    shouldResume: () => armed,

    resumed() {
      armed = false;
    },
  };
}
