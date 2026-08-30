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
  // The separate window that asks for the device permission could not be
  // opened. Distinct from LedgerPermissionRequired: there is no window for the
  // user to grant anything in, so telling them to grant it is the wrong error.
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

/**
 * The transport surface the Ledger service drives. Structurally satisfied by
 * `@ledgerhq/hw-transport`'s `Transport`, which the apps create and own — declaring it here keeps
 * that package out of this library's dependency graph.
 */
export interface ILedgerTransport {
  close(): Promise<void>;
  on(eventName: string, cb: (...args: any[]) => any): void;
  off(eventName: string, cb: (...args: any[]) => any): void;
  setExchangeTimeout(exchangeTimeout: number): void;
}

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
