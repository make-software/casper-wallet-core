import type { Observable } from 'rxjs';

export enum LedgerEventStatus {
  Disconnected = 'ledger-disconnected',
  NotAvailable = 'ledger-not-available',
  DeviceLocked = 'ledger-device-locked',
  WaitingResponseFromDevice = 'ledger-waiting-response-from-device',
  WaitingToSignPrevDeploy = 'waiting-to-sign-prev-deploy',
  CasperAppNotLoaded = 'ledger-casper-app-not-loaded',
  Connected = 'ledger-connected',
  LoadingAccountsList = 'ledger-loading-accounts-list',
  AccountListUpdated = 'ledger-account-list-updated',
  AccountListFailed = 'ledger-account-list-failed',
  SignatureRequestedToUser = 'ledger-signature-requested-to-user',
  SignatureCompleted = 'ledger-signature-completed',
  SignatureCanceled = 'ledger-signature-cancelled',
  SignatureFailed = 'ledger-signature-failed',
  MsgSignatureRequestedToUser = 'ledger-msg-signature-requested-to-user',
  MsgSignatureCompleted = 'ledger-msg-signature-completed',
  MsgSignatureCanceled = 'ledger-msg-signature-cancelled',
  MsgSignatureFailed = 'ledger-msg-signature-failed',
  LedgerPermissionRequired = 'ledger-permission-required',
  // The permission window could not be opened — unlike LedgerPermissionRequired, there is no
  // window for the user to grant anything in.
  PermissionWindowFailed = 'ledger-permission-window-failed',
  LedgerAskPermission = 'ledger-ask-permission',
  ErrorOpeningDevice = 'ledger-error-opening-device',
  Timeout = 'ledger-timeout',
  InvalidIndex = 'ledger-invalid-index',
  TransactionForOldAppVersion = 'ledger-transaction-for-old-app-version',
  BleDeviceSelection = 'ledger-ble-device-selection',
  BluetoothPairingInvalidated = 'ledger-bluetooth-pairing-invalidated',
}

export interface LedgerAccount {
  publicKey: string;
  index: number;
}

export interface ILedgerEvent {
  status: LedgerEventStatus;
  publicKey?: string;
  firstAcctIndex?: number;
  accounts?: LedgerAccount[];
  txHash?: string;
  error?: string;
  message?: string;
  msgHash?: string;
  signatureHex?: string;
  appVersion?: string;
}

export interface LedgerAccountsOptions {
  size: number;
  offset: number;
}

export interface SignResult {
  signatureHex: string;
  signature: Uint8Array;
  prefixedSignatureHex: string;
  prefixedSignature: Uint8Array;
}

export type LedgerTransport = 'USB' | 'Bluetooth';
export type SelectedTransport = LedgerTransport | undefined;

/** Device state as this library models it, independent of any vendor SDK. */
export type LedgerDeviceStatus = 'connected' | 'locked' | 'busy' | 'disconnected' | 'unknown';

export interface LedgerDeviceState {
  status: LedgerDeviceStatus;
  /** The app the device currently has open, when the transport can report it. */
  app?: { name: string; version: string };
}

/**
 * The transport surface the Ledger service drives — satisfied equally by
 * `@ledgerhq/hw-transport`'s `Transport` and by an app's own DMK-session adapter. `'disconnect'` is
 * the only event ever subscribed, and it fires at most once per session; `setExchangeTimeout`
 * latches a value for subsequent exchanges rather than applying to one already in flight.
 */
export interface ILedgerTransport {
  close(): Promise<void>;
  on(eventName: string, cb: (...args: any[]) => any): void;
  off(eventName: string, cb: (...args: any[]) => any): void;
  setExchangeTimeout(exchangeTimeout: number): void;
  /**
   * Device state pushed by the transport. Optional: a transport with no state channel leaves
   * the service on its APDU status-word classification, which stays the fallback for as long
   * as this member is optional.
   */
  observeState?(): Observable<LedgerDeviceState>;
}

/** The returned object must also satisfy whatever the app's `createLedgerApp` consumes. */
export type TransportCreator = () => Promise<ILedgerTransport>;
export type TransportAvailabilityCheck = () => Promise<boolean>;

export interface ILedgerResponse {
  /** APDU status word: `0x9000` on success. */
  returnCode: number;
  errorMessage: string;
}

export interface ILedgerAppInfoResponse extends ILedgerResponse {
  appName: string;
  appVersion: string;
}

export interface ILedgerAddressResponse extends ILedgerResponse {
  publicKey: Uint8Array;
}

export interface ILedgerSignResponse extends ILedgerResponse {
  signatureRS: Buffer;
  signatureRSV: Buffer;
}

/**
 * The Casper Ledger app the service talks to. Structurally satisfied by `@zondax/ledger-casper`'s
 * default export, which the apps construct and pass in via
 * {@link ICasperLedgerServiceOptions.createLedgerApp}.
 */
export interface ILedgerCasperApp {
  getAppInfo(): Promise<ILedgerAppInfoResponse>;
  getAddressAndPubKey(path: string): Promise<ILedgerAddressResponse>;
  sign(path: string, message: Buffer): Promise<ILedgerSignResponse>;
  signWasmDeploy(path: string, message: Buffer): Promise<ILedgerSignResponse>;
  signMessage(path: string, message: Buffer): Promise<ILedgerSignResponse>;
}
