import { ILedgerEvent, LedgerEventStatus } from './entities';

export class LedgerError extends Error {
  constructor(readonly ledgerEvent: ILedgerEvent) {
    super(JSON.stringify(ledgerEvent));
  }
}

export const LEDGER_ERROR_STATUSES: ReadonlySet<LedgerEventStatus> = new Set([
  LedgerEventStatus.Timeout,
  LedgerEventStatus.InvalidIndex,
  LedgerEventStatus.ErrorOpeningDevice,
  LedgerEventStatus.LedgerPermissionRequired,
  LedgerEventStatus.MsgSignatureFailed,
  LedgerEventStatus.MsgSignatureCanceled,
  LedgerEventStatus.SignatureFailed,
  LedgerEventStatus.SignatureCanceled,
  LedgerEventStatus.AccountListFailed,
  LedgerEventStatus.CasperAppNotLoaded,
  LedgerEventStatus.DeviceLocked,
  LedgerEventStatus.NotAvailable,
  LedgerEventStatus.WaitingToSignPrevDeploy,
  LedgerEventStatus.TransactionForOldAppVersion,
  LedgerEventStatus.BluetoothPairingInvalidated,
]);

export const isLedgerErrorEvent = (event: ILedgerEvent): boolean =>
  LEDGER_ERROR_STATUSES.has(event.status);

/** The two statuses that mean the user declined on the device, rather than anything going wrong. */
export const LEDGER_CANCELLATION_STATUSES: ReadonlySet<LedgerEventStatus> = new Set([
  LedgerEventStatus.SignatureCanceled,
  LedgerEventStatus.MsgSignatureCanceled,
]);

/**
 * Whether an error is a user's on-device rejection. The default `isCancellationError` for the
 * swap and wrap flows.
 */
export const isLedgerSignatureCancelled = (error: unknown): boolean =>
  error instanceof LedgerError && LEDGER_CANCELLATION_STATUSES.has(error.ledgerEvent.status);

/**
 * The statuses that answer for a submit: the device reported an outcome and the submit must
 * never be re-issued afterwards. Distinct from {@link LEDGER_ERROR_STATUSES}, which also holds
 * interruptions — `DeviceLocked` and `CasperAppNotLoaded` leave a submit unanswered, which is
 * the case recovery exists for.
 */
export const LEDGER_SUBMIT_OUTCOME_STATUSES: ReadonlySet<LedgerEventStatus> = new Set([
  LedgerEventStatus.SignatureCompleted,
  LedgerEventStatus.SignatureCanceled,
  LedgerEventStatus.SignatureFailed,
  LedgerEventStatus.MsgSignatureCompleted,
  LedgerEventStatus.MsgSignatureCanceled,
  LedgerEventStatus.MsgSignatureFailed,
]);

/** Whether the device has answered for a submit — see {@link LEDGER_SUBMIT_OUTCOME_STATUSES}. */
export const ledgerEventAnswersSubmit = (status: LedgerEventStatus): boolean =>
  LEDGER_SUBMIT_OUTCOME_STATUSES.has(status);
