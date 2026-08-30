import { ILedgerEvent, LedgerEventStatus } from './entities';

export class LedgerError extends Error {
  constructor(ledgerEvent: ILedgerEvent) {
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
