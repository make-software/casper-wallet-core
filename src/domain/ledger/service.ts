import type { Transaction } from 'casper-js-sdk'; // type-only — the sdk-free gate checks value imports
import type { Subscription } from 'rxjs';
import type {
  ILedgerCasperApp,
  ILedgerEvent,
  ILedgerTransport,
  LedgerAccount,
  LedgerAccountsOptions,
  LedgerEventStatus,
  SignResult,
  TransportAvailabilityCheck,
  TransportCreator,
} from './entities';

export interface ICasperLedgerServiceOptions {
  /**
   * Builds the Casper app for a freshly opened transport, e.g. `t => new CasperApp(t)` with
   * `@zondax/ledger-casper`. Declared as a method so a factory typed against the app's own
   * concrete transport class is accepted.
   */
  createLedgerApp(transport: ILedgerTransport): ILedgerCasperApp;
  /** Platform hook: detect transport-level "pairing invalidated" errors (RN BLE shapes). Default: () => false. */
  isPairingInvalidatedError?(e: unknown): boolean;
}

/**
 * A connected Ledger device session. Every method that reports progress does so through
 * {@link subscribeToLedgerEventStatus}, and every failure is a `LedgerError` carrying the
 * `ILedgerEvent` that describes it.
 */
export interface ICasperLedgerService {
  /** Accounts from the last successful {@link getAccountList}; cleared on disconnect. */
  cachedAccounts: LedgerAccount[];
  readonly isConnected: boolean;
  subscribeToLedgerEventStatus(onData: (evt: ILedgerEvent) => void): Subscription;
  /** @throws {LedgerError} */
  connect(
    transportCreator: TransportCreator,
    checkTransportAvailability: TransportAvailabilityCheck,
    isBluetoothTransport?: boolean,
  ): Promise<void>;
  disconnect(): Promise<boolean>;
  /** `null` when the Casper app is open and idle; otherwise the status blocking the next call. */
  checkAppInfo(): Promise<LedgerEventStatus | null>;
  /** @throws {LedgerError} */
  getAccountList(options: LedgerAccountsOptions): Promise<void>;
  /** @throws {LedgerError} */
  signTransaction(
    tx: Transaction,
    account: Partial<LedgerAccount>,
    supportsTransactionV1Cb?: (publicKey: string, supports: boolean) => Promise<void>,
    tryRestoreConnection?: () => Promise<void>,
  ): Promise<SignResult>;
  /** @throws {LedgerError} */
  getSignedTransaction(
    tx: Transaction,
    account: Partial<Pick<LedgerAccount, 'index'>> & Pick<LedgerAccount, 'publicKey'>,
    fallbackTxFromDeploy?: Transaction,
    supportsTransactionV1Cb?: (publicKey: string, supports: boolean) => Promise<void>,
    tryRestoreConnection?: () => Promise<void>,
  ): Promise<Transaction>;
  /** @throws {LedgerError} */
  signMessage(
    message: string,
    account: Partial<LedgerAccount>,
    tryRestoreConnection?: () => Promise<void>,
  ): Promise<Pick<SignResult, 'signature' | 'signatureHex'>>;
}
