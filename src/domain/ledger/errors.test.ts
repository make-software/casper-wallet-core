import { ILedgerEvent, LedgerEventStatus } from './entities';
import { isLedgerErrorEvent, LEDGER_ERROR_STATUSES, LedgerError } from './errors';

describe('LedgerEventStatus', () => {
  it('has all 27 members with mobile-matching string values', () => {
    expect(Object.values(LedgerEventStatus)).toHaveLength(27);
    expect(LedgerEventStatus.Disconnected).toBe('ledger-disconnected');
    expect(LedgerEventStatus.NotAvailable).toBe('ledger-not-available');
    expect(LedgerEventStatus.WaitingToSignPrevDeploy).toBe('waiting-to-sign-prev-deploy');
    expect(LedgerEventStatus.BleDeviceSelection).toBe('ledger-ble-device-selection');
    expect(LedgerEventStatus.BluetoothPairingInvalidated).toBe(
      'ledger-bluetooth-pairing-invalidated',
    );
  });
});

describe('LedgerError', () => {
  it('carries the event as its JSON-stringified message and is an Error', () => {
    const event: ILedgerEvent = { status: LedgerEventStatus.Disconnected };
    const error = new LedgerError(event);

    expect(error.message).toBe(JSON.stringify(event));
    expect(error).toBeInstanceOf(Error);
  });
});

describe('LEDGER_ERROR_STATUSES', () => {
  it('contains exactly the statuses both apps mark with a non-null title', () => {
    expect([...LEDGER_ERROR_STATUSES].sort()).toEqual(
      [
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
      ].sort(),
    );
  });
});

describe('isLedgerErrorEvent', () => {
  it('is true iff the event status is in LEDGER_ERROR_STATUSES', () => {
    expect(isLedgerErrorEvent({ status: LedgerEventStatus.Timeout })).toBe(true);
    expect(isLedgerErrorEvent({ status: LedgerEventStatus.Connected })).toBe(false);
    expect(isLedgerErrorEvent({ status: LedgerEventStatus.PermissionWindowFailed })).toBe(false);
  });
});
