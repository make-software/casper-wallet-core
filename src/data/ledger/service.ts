import { blake2b } from '@noble/hashes/blake2';
import { HexBytes, PublicKey, Transaction } from 'casper-js-sdk';
import {
  BehaviorSubject,
  debounceTime,
  distinct,
  distinctUntilChanged,
  filter,
  Observable,
  Observer,
  Subscription,
} from 'rxjs';

import {
  ICasperLedgerService,
  ICasperLedgerServiceOptions,
  ILedgerCasperApp,
  ILedgerEvent,
  ILedgerSignResponse,
  ILedgerTransport,
  LedgerAccount,
  LedgerAccountsOptions,
  LedgerDeviceState,
  LedgerError,
  LedgerEventStatus,
  SignResult,
  TransportAvailabilityCheck,
  TransportCreator,
} from '../../domain';
import { delay } from '../../utils/common';

const CONNECTION_TIMEOUT_MS = 60000;
const CONNECTION_POLL_INTERVAL = 3000;

// Registered at https://github.com/satoshilabs/slips/blob/master/slip-0044.md
const CSPR_COIN_INDEX = 506;

function getBip44Path(index: number): string {
  return [
    'm',
    "44'", // bip 44
    `${CSPR_COIN_INDEX}'`, // coin index
    "0'", // wallet
    '0', // external
    `${index}`, // child account index
  ].join('/');
}

function isSameDeviceState(a: LedgerDeviceState, b: LedgerDeviceState): boolean {
  return a.status === b.status && a.app?.name === b.app?.name && a.app?.version === b.app?.version;
}

interface ConnectArgs {
  transportCreator: TransportCreator;
  checkTransportAvailability: TransportAvailabilityCheck;
  isBluetoothTransport: boolean;
}

function isSameConnectArgs(a: ConnectArgs, b: ConnectArgs): boolean {
  return (
    a.transportCreator === b.transportCreator &&
    a.checkTransportAvailability === b.checkTransportAvailability &&
    a.isBluetoothTransport === b.isBluetoothTransport
  );
}

export class CasperLedgerService implements ICasperLedgerService {
  cachedAccounts: LedgerAccount[] = [];

  #transport: ILedgerTransport | null = null;
  #stateSubscription: Subscription | null = null;
  /** The in-flight `#connectToLedger` wait's hooks into device-state transitions, when it has one. */
  #connectionWaitHandlers: {
    onConnected: () => void;
    onChannelError: () => void;
    cancel: () => void;
  } | null = null;
  #isBluetoothTransport: boolean = false;
  #ledgerApp: ILedgerCasperApp | null = null;
  #ledgerConnected = false;
  #allowReconnect: boolean = true;
  /** A `connected` state that arrived while the reconnection gate was shut, replayed when it reopens. */
  #pendingConnectedState: { state: LedgerDeviceState; transport: ILedgerTransport } | null = null;
  #exchangeDepth = 0;
  #options: ICasperLedgerServiceOptions;
  #createLedgerApp: (transport: ILedgerTransport) => ILedgerCasperApp;
  #ledgerEventStatusSubject = new BehaviorSubject<ILedgerEvent>({
    status: LedgerEventStatus.Disconnected,
  });

  constructor(options: ICasperLedgerServiceOptions) {
    this.#options = options;
    this.#createLedgerApp = options.createLedgerApp;
  }

  subscribeToLedgerEventStatus = (onData: (evt: ILedgerEvent) => void): Subscription =>
    this.#ledgerEventStatusSubject.pipe(debounceTime(300)).subscribe(onData);

  readonly ledgerEvents$: Observable<ILedgerEvent> = this.#ledgerEventStatusSubject.asObservable();

  #connectInFlight: { promise: Promise<void>; args: ConnectArgs } | null = null;

  /** @throws {LedgerError} */
  connect(
    transportCreator: TransportCreator,
    checkTransportAvailability: TransportAvailabilityCheck,
    isBluetoothTransport = false,
  ): Promise<void> {
    const args: ConnectArgs = {
      transportCreator,
      checkTransportAvailability,
      isBluetoothTransport,
    };
    const inFlight = this.#connectInFlight;

    if (inFlight) {
      // Sharing the attempt is only sound while the callers asked for the same thing; a caller
      // that asked for a different transport gets its own attempt, queued behind this one.
      return isSameConnectArgs(inFlight.args, args)
        ? inFlight.promise
        : inFlight.promise
            .catch(() => undefined)
            .then(() =>
              this.connect(transportCreator, checkTransportAvailability, isBluetoothTransport),
            );
    }

    const promise = this.#runConnect(args).finally(() => {
      this.#connectInFlight = null;
    });

    this.#connectInFlight = { promise, args };

    return promise;
  }

  async #runConnect({
    transportCreator,
    checkTransportAvailability,
    isBluetoothTransport,
  }: ConnectArgs): Promise<void> {
    this.#isBluetoothTransport = isBluetoothTransport;

    return new Promise<void>((resolve, reject) => {
      const failWith = (status: LedgerEventStatus): void => {
        const evt: ILedgerEvent = { status };
        this.#ledgerEventStatusSubject.next(evt);
        reject(new LedgerError(evt));
      };

      const openingFailureStatus = (e: unknown): LedgerEventStatus =>
        this.#options.isPairingInvalidatedError?.(e)
          ? LedgerEventStatus.BluetoothPairingInvalidated
          : LedgerEventStatus.ErrorOpeningDevice;

      const run = async (): Promise<void> => {
        let available = false;

        try {
          available = await checkTransportAvailability();
        } catch {
          // an availability probe that throws is an unavailable transport, not a hung connect
        }

        if (!available) {
          failWith(LedgerEventStatus.NotAvailable);

          return;
        }

        const connectionObserver: Observer<ILedgerEvent> = {
          next: data => {
            this.#ledgerEventStatusSubject.next(data);

            if (
              data.status === LedgerEventStatus.Timeout ||
              data.status === LedgerEventStatus.ErrorOpeningDevice ||
              data.status === LedgerEventStatus.BluetoothPairingInvalidated
            ) {
              reject(new LedgerError(data));
            }
          },
          error: e => {
            failWith(openingFailureStatus(e));
          },
          complete: async () => {
            resolve();
          },
        };

        const tryToConnect = async (withRetry = true): Promise<void> => {
          // Releasing mid-exchange would close the session the device is answering on; keep the
          // live transport and let the wait run against it instead.
          if (this.#exchangeDepth > 0 && this.#transport) {
            return;
          }

          try {
            await this.#releaseTransport();
            this.#transport = await transportCreator();
            this.#transport?.on('disconnect', this.#onDisconnect);
            this.#ledgerApp = this.#createLedgerApp(this.#transport);
            this.#observeTransportState(this.#transport);
          } catch (e) {
            if (withRetry) {
              await delay(500);
              await tryToConnect(false);
            } else {
              throw e;
            }
          }
        };

        try {
          await tryToConnect();
        } catch (e) {
          if (!this.#transport) {
            failWith(openingFailureStatus(e));

            return;
          }
        }

        this.#connectToLedger(transportCreator, connectionObserver);
      };

      run().catch(e => failWith(openingFailureStatus(e)));
    });
  }

  async disconnect(): Promise<boolean> {
    const wasConnected = this.#ledgerConnected;

    this.#connectionWaitHandlers?.cancel();
    this.#connectionWaitHandlers = null;
    await this.#releaseTransport();
    this.cachedAccounts = [];

    if (wasConnected) {
      this.#ledgerEventStatusSubject.next({
        status: LedgerEventStatus.Disconnected,
      });
    }

    return true;
  }

  get isConnected(): boolean {
    return this.#ledgerConnected;
  }

  async checkAppInfo(): Promise<LedgerEventStatus | null> {
    if (this.#ledgerConnected && this.#ledgerApp) {
      const appInfo = await this.#ledgerApp?.getAppInfo();

      await this.#processDelayAfterAction();

      if (appInfo.returnCode === 65535) {
        return LedgerEventStatus.WaitingToSignPrevDeploy;
      }

      return appInfo.returnCode === 0x9000 && appInfo.appName === 'Casper'
        ? null
        : LedgerEventStatus.WaitingResponseFromDevice;
    }

    return LedgerEventStatus.WaitingResponseFromDevice;
  }

  /** @throws {LedgerError} message - ILedgerEvent JSON */
  getAccountList = async ({ size, offset }: LedgerAccountsOptions): Promise<void> => {
    try {
      if (!this.#ledgerApp || !this.#ledgerConnected) {
        return;
      }

      this.#ledgerEventStatusSubject.next({
        status: LedgerEventStatus.LoadingAccountsList,
      });

      const response = await this.#ledgerApp.getAddressAndPubKey(this.#getAccountPath(offset));
      await this.#processDelayAfterAction();

      if (!response || response.returnCode !== 0x9000) {
        if (response?.returnCode === 0xffff || response.returnCode === 21781) {
          this.#processError({ status: LedgerEventStatus.DeviceLocked });
        } else if (response?.returnCode === 0x6e01) {
          this.#processError({ status: LedgerEventStatus.CasperAppNotLoaded });
        } else {
          this.#processError({ status: LedgerEventStatus.AccountListFailed });
        }
      }

      const publicKeys: string[] = [this.#encodePublicKey(response.publicKey)];

      for (let i = 1; i < size; i++) {
        const key = await this.#ledgerApp.getAddressAndPubKey(this.#getAccountPath(offset + i));
        await this.#processDelayAfterAction();

        publicKeys.push(this.#encodePublicKey(key.publicKey));
      }

      const updatedAccountList = publicKeys.map<LedgerAccount>((pk, i) => ({
        publicKey: pk,
        index: offset + i,
      }));

      const appInfo = await this.#ledgerApp?.getAppInfo();

      this.#ledgerEventStatusSubject.next({
        status: LedgerEventStatus.AccountListUpdated,
        firstAcctIndex: offset,
        accounts: updatedAccountList,
        appVersion: appInfo.appVersion,
      });

      if (offset === this.cachedAccounts.length) {
        this.cachedAccounts.push(...updatedAccountList);
      }
    } catch (e) {
      if (e instanceof LedgerError) {
        throw e;
      } else {
        this.#processError({ status: LedgerEventStatus.AccountListFailed });
      }
    }
  };

  /** @throws {LedgerError} message - ILedgerEvent JSON */
  async signTransaction(
    tx: Transaction,
    account: Partial<LedgerAccount>,
    supportsTransactionV1Cb?: (publicKey: string, supports: boolean) => Promise<void>,
    tryRestoreConnection?: () => Promise<void>,
  ): Promise<SignResult> {
    try {
      if (account.index === undefined) {
        this.#processError({ status: LedgerEventStatus.InvalidIndex });
      }

      if (!this.#ledgerConnected && tryRestoreConnection) {
        this.#ledgerEventStatusSubject.next({
          status: LedgerEventStatus.WaitingResponseFromDevice,
        });
        await tryRestoreConnection();
      }

      await this.#checkConnection(account.index);

      const appInfo = await this.#ledgerApp?.getAppInfo();
      const appSupportsTransactionV1 = Number(appInfo?.appVersion?.[0] ?? 2) > 2;

      if (!appSupportsTransactionV1 && !tx.getDeploy()) {
        this.#processError({
          status: LedgerEventStatus.TransactionForOldAppVersion,
        });
      }

      const txHash = tx.hash.toHex();

      const devicePk =
        account.index !== undefined
          ? await this.#ledgerApp?.getAddressAndPubKey(this.#getAccountPath(account.index))
          : undefined;
      await this.#processDelayAfterAction();

      if (!devicePk) {
        this.#processError({
          status: LedgerEventStatus.SignatureFailed,
          error: 'Could not retrieve key by index from device',
          publicKey: account.publicKey,
          txHash,
        });
      }

      const keyFromDevice: string = this.#encodePublicKey(devicePk.publicKey);

      if (account.publicKey !== keyFromDevice) {
        this.#processError({
          status: LedgerEventStatus.SignatureFailed,
          error: 'Signing key not found on Ledger device. Signature process failed',
          publicKey: account.publicKey,
          txHash,
        });
      }

      this.#ledgerEventStatusSubject.next({
        status: LedgerEventStatus.SignatureRequestedToUser,
        publicKey: account.publicKey,
        txHash,
      });

      let result: ILedgerSignResponse | undefined;
      const accountPath = this.#getAccountPath(account.index);

      if (appSupportsTransactionV1) {
        if (tx.getDeploy()?.session?.isModuleBytes()) {
          // Ledger app v3 still requires signWasmDeploy for legacy WASM Deploys
          result = await this.#exchange(() =>
            this.#ledgerApp?.signWasmDeploy(accountPath, Buffer.from(tx.toBytes())),
          );
        } else {
          const txBytes = tx.toBytes();
          result = await this.#exchange(() =>
            this.#ledgerApp?.sign(accountPath, Buffer.from(txBytes)),
          );
        }

        supportsTransactionV1Cb?.(account.publicKey, true);
      } else {
        const deploy = tx.getDeploy();

        if (!deploy) {
          this.#processError({
            status: LedgerEventStatus.TransactionForOldAppVersion,
          });
        }

        if (deploy.session.isModuleBytes()) {
          result = await this.#exchange(() =>
            this.#ledgerApp?.signWasmDeploy(accountPath, Buffer.from(deploy.toBytes())),
          );
        } else {
          result = await this.#exchange(() =>
            this.#ledgerApp?.sign(accountPath, Buffer.from(deploy.toBytes())),
          );
        }

        supportsTransactionV1Cb?.(account.publicKey, false);
      }

      await this.#processDelayAfterAction();

      if (!result) {
        this.#processError({
          status: LedgerEventStatus.SignatureFailed,
          error: 'No response from device',
          publicKey: account.publicKey,
          txHash,
        });
      }

      if (result.returnCode === 0x6986) {
        // transaction rejected
        this.#processError({
          status: LedgerEventStatus.SignatureCanceled,
          publicKey: account.publicKey,
          txHash,
        });
      }

      if (result.returnCode !== 0x9000) {
        this.#processError({
          status: LedgerEventStatus.SignatureFailed,
          error: result.errorMessage,
          publicKey: account.publicKey,
          txHash,
        });
      }

      // remove V byte if included
      const patchedSignature =
        result.signatureRSV.length > 64 ? result.signatureRSV.subarray(0, 64) : result.signatureRSV;

      const prefixedSignatureHex = `02${patchedSignature.toString('hex')}`;

      this.#ledgerEventStatusSubject.next({
        status: LedgerEventStatus.SignatureCompleted,
        publicKey: account.publicKey,
        txHash,
        signatureHex: prefixedSignatureHex,
      });

      const prefix = new Uint8Array([0x02]);

      if (!prefixedSignatureHex) {
        this.#processError({
          status: LedgerEventStatus.SignatureFailed,
          publicKey: account.publicKey,
          txHash,
          error: 'Empty signature',
        });
      }

      return {
        signatureHex: patchedSignature.toString('hex'),
        signature: patchedSignature,
        prefixedSignatureHex,
        prefixedSignature: new Uint8Array([...prefix, ...patchedSignature]),
      };
    } catch (e) {
      if (e instanceof LedgerError) {
        throw e;
      } else {
        this.#processError({
          status: LedgerEventStatus.SignatureFailed,
          error: 'Unknown signature error',
        });
      }
    }
  }

  async getSignedTransaction(
    tx: Transaction,
    account: Partial<Pick<LedgerAccount, 'index'>> & Pick<LedgerAccount, 'publicKey'>,
    fallbackTxFromDeploy?: Transaction,
    supportsTransactionV1Cb?: (publicKey: string, supports: boolean) => Promise<void>,
    tryRestoreConnection?: () => Promise<void>,
  ): Promise<Transaction> {
    if (account.index === undefined) {
      this.#processError({ status: LedgerEventStatus.InvalidIndex });
    }

    if (!this.#ledgerConnected && tryRestoreConnection) {
      this.#ledgerEventStatusSubject.next({
        status: LedgerEventStatus.WaitingResponseFromDevice,
      });
      await tryRestoreConnection();
    }

    await this.#checkConnection(account.index);

    const appInfo = await this.#ledgerApp?.getAppInfo();
    const appSupportsTransactionV1 = Number(appInfo?.appVersion?.[0] ?? 2) > 2;

    if (appSupportsTransactionV1) {
      const resp = await this.signTransaction(tx, account, supportsTransactionV1Cb);

      tx.setSignature(
        HexBytes.fromHex(resp.prefixedSignatureHex).bytes,
        PublicKey.fromHex(account.publicKey),
      );

      return tx;
    } else {
      if (!fallbackTxFromDeploy) {
        this.#processError({
          status: LedgerEventStatus.TransactionForOldAppVersion,
        });
      }

      const resp = await this.signTransaction(
        fallbackTxFromDeploy,
        account,
        supportsTransactionV1Cb,
      );

      fallbackTxFromDeploy.setSignature(
        HexBytes.fromHex(resp.prefixedSignatureHex).bytes,
        PublicKey.fromHex(account.publicKey),
      );

      return fallbackTxFromDeploy;
    }
  }

  /** @throws {LedgerError} message - ILedgerEvent JSON */
  async signMessage(
    message: string,
    account: Partial<LedgerAccount>,
    tryRestoreConnection?: () => Promise<void>,
  ): Promise<Pick<SignResult, 'signature' | 'signatureHex'>> {
    try {
      if (account.index === undefined) {
        this.#processError({ status: LedgerEventStatus.InvalidIndex });
      }

      if (!this.#ledgerConnected && tryRestoreConnection) {
        this.#ledgerEventStatusSubject.next({
          status: LedgerEventStatus.WaitingResponseFromDevice,
        });
        await tryRestoreConnection();
      }

      await this.#checkConnection(account.index);

      const prefixedMessage = Buffer.from(`Casper Message:\n${message}`, 'utf-8');
      const hashedMessage = Buffer.from(blake2b(prefixedMessage, { dkLen: 32 })).toString('hex');

      this.#ledgerEventStatusSubject.next({
        status: LedgerEventStatus.MsgSignatureRequestedToUser,
        publicKey: account.publicKey,
        message,
        msgHash: hashedMessage,
      });

      this.#transport?.setExchangeTimeout(10000);

      const accountPath = this.#getAccountPath(account.index);
      const result: ILedgerSignResponse | undefined = await this.#exchange(() =>
        this.#ledgerApp?.signMessage(accountPath, prefixedMessage),
      );

      await this.#processDelayAfterAction();

      if (!result) {
        this.#processError({
          status: LedgerEventStatus.MsgSignatureFailed,
          error: 'No response from device',
        });
      }

      if (result.returnCode === 0x6986) {
        // transaction rejected
        this.#processError({ status: LedgerEventStatus.MsgSignatureCanceled });
      }

      if (result.returnCode !== 0x9000) {
        this.#processError({
          status: LedgerEventStatus.MsgSignatureFailed,
          error: `Error: ${result.errorMessage}`,
        });
      }

      // remove V byte if included
      const patchedSignature =
        result.signatureRSV.length > 64 ? result.signatureRSV.subarray(0, 64) : result.signatureRSV;

      this.#ledgerEventStatusSubject.next({
        status: LedgerEventStatus.MsgSignatureCompleted,
        publicKey: account.publicKey,
        message: message,
        msgHash: hashedMessage,
        signatureHex: patchedSignature.toString('hex'),
      });

      return {
        signatureHex: patchedSignature.toString('hex'),
        signature: patchedSignature,
      };
    } catch (e) {
      if (e instanceof LedgerError) {
        throw e;
      } else {
        this.#processError({
          status: LedgerEventStatus.MsgSignatureFailed,
          error: 'Unknown msg signature error',
        });
      }
    }
  }

  #checkConnection = async (accountIndex?: number) => {
    let evt;

    if (Number.isNaN(Number(accountIndex))) {
      evt = { status: LedgerEventStatus.InvalidIndex };
    } else if (!this.#ledgerConnected) {
      evt = { status: LedgerEventStatus.Disconnected };
    } else {
      const status = await this.checkAppInfo();

      if (status) {
        evt = { status };
      }
    }

    if (evt) {
      this.#processError(evt);
    }
  };

  /**
   * Detaches and closes the current transport, if any, and drops the reference. Never rejects:
   * a transport being replaced is already gone as far as the caller is concerned.
   */
  #releaseTransport = async (): Promise<void> => {
    this.#stateSubscription?.unsubscribe();
    this.#stateSubscription = null;
    this.#pendingConnectedState = null;

    const transport = this.#transport;

    if (!transport) return;

    this.#transport = null;
    this.#ledgerApp = null;
    this.#ledgerConnected = false;

    try {
      transport.off('disconnect', this.#onDisconnect);
      await transport.close();
    } catch {
      // best-effort: the transport is being discarded either way
    }
  };

  /** The transport's own `'disconnect'` event: the handle is already gone, so nothing to close. */
  #onDisconnect = () => {
    this.#handleSessionLost(false);
  };

  /**
   * @param closeTransport whether the session behind the transport may still be open — true for a
   * `disconnected` pushed on the state channel, false for the transport's own `'disconnect'` event.
   */
  #handleSessionLost(closeTransport: boolean): void {
    const transport = this.#transport;

    this.#ledgerConnected = false;
    this.#allowReconnect = false;
    this.cachedAccounts = [];
    this.#pendingConnectedState = null;
    this.#stateSubscription?.unsubscribe();
    this.#stateSubscription = null;
    this.#ledgerEventStatusSubject.next({
      status: LedgerEventStatus.Disconnected,
    });
    transport?.off('disconnect', this.#onDisconnect);
    this.#transport = null;

    if (closeTransport && transport) {
      try {
        transport.close().catch(() => undefined);
      } catch {
        // best-effort: the device session is being abandoned either way
      }
    }

    setTimeout(() => {
      this.#allowReconnect = true;

      const pending = this.#pendingConnectedState;

      if (pending && this.#transport === pending.transport) {
        this.#pendingConnectedState = null;
        this.#applyDeviceState(pending.state, pending.transport);
      }
    }, CONNECTION_POLL_INTERVAL * 1.2);
  }

  /**
   * Subscribes to the transport's state channel when it has one. Bound to that transport: it is
   * released by `#releaseTransport` and `#handleSessionLost`, and drops emissions after either.
   */
  #observeTransportState(transport: ILedgerTransport): void {
    if (!transport.observeState) return;

    const subscription = transport
      .observeState()
      .pipe(
        filter(state => state.status !== 'busy' && state.status !== 'unknown'),
        distinctUntilChanged(isSameDeviceState),
      )
      .subscribe({
        next: state => this.#applyDeviceState(state, transport),
        error: () => {
          if (this.#transport !== transport) return;

          this.#stateSubscription = null;
          this.#connectionWaitHandlers?.onChannelError();
        },
      });

    // A channel that emits synchronously on subscribe can have dropped this transport already,
    // which would otherwise leave the subscription attached to a session nothing holds.
    if (this.#transport === transport) {
      this.#stateSubscription = subscription;
    } else {
      subscription.unsubscribe();
    }
  }

  /** Maps a pushed device state to the same events the status-word path would raise. */
  #applyDeviceState(state: LedgerDeviceState, transport: ILedgerTransport): void {
    if (this.#transport !== transport) return;

    switch (state.status) {
      case 'locked':
        this.#ledgerConnected = false;
        this.#ledgerEventStatusSubject.next({ status: LedgerEventStatus.DeviceLocked });
        return;
      case 'connected':
        // No app identity decides nothing; the poll running underneath the wait resolves it.
        if (!state.app) return;

        if (state.app.name !== 'Casper') {
          this.#ledgerConnected = false;
          this.#ledgerEventStatusSubject.next({ status: LedgerEventStatus.CasperAppNotLoaded });
          return;
        }

        if (!this.#allowReconnect) {
          // distinctUntilChanged would swallow a repeat of this state, so hold it for the reopen.
          this.#pendingConnectedState = { state, transport };
          return;
        }

        this.#ledgerConnected = true;
        this.#ledgerEventStatusSubject.next({ status: LedgerEventStatus.Connected });
        this.#connectionWaitHandlers?.onConnected();
        return;
      case 'disconnected':
        this.#handleSessionLost(true);
        return;
      default:
        return;
    }
  }

  #getAccountPath = (acctIdx: number): string => getBip44Path(acctIdx);

  #encodePublicKey = (bytes: Uint8Array) => '02' + Buffer.from(bytes).toString('hex');

  #connectToLedger(transportCreator: TransportCreator, observer: Observer<ILedgerEvent>): void {
    const observable = new Observable<ILedgerEvent>(subscriber => {
      /** @return {boolean} is should stop retries */
      const retryConnection = async (): Promise<boolean> => {
        if (!this.#transport) {
          try {
            this.#transport = await transportCreator();
            this.#transport.on('disconnect', this.#onDisconnect);
            this.#ledgerApp = this.#createLedgerApp(this.#transport);
            this.#observeTransportState(this.#transport);
          } catch (e) {
            subscriber.next({
              status: this.#options.isPairingInvalidatedError?.(e)
                ? LedgerEventStatus.BluetoothPairingInvalidated
                : LedgerEventStatus.ErrorOpeningDevice,
            });

            return true;
          }
        }

        if (!this.#transport || !this.#ledgerApp) {
          return false;
        }

        subscriber.next({
          status: LedgerEventStatus.WaitingResponseFromDevice,
        });

        try {
          const appInfo = await this.#ledgerApp.getAppInfo();
          await this.#processDelayAfterAction();

          if (appInfo.returnCode === 0xffff || appInfo.returnCode === 21781) {
            subscriber.next({ status: LedgerEventStatus.DeviceLocked });

            return false;
          }

          if (appInfo.returnCode !== 0x9000) {
            return false;
          }

          if (appInfo.appName !== 'Casper') {
            subscriber.next({ status: LedgerEventStatus.CasperAppNotLoaded });

            return false;
          }

          this.#ledgerConnected = true;
          subscriber.next({ status: LedgerEventStatus.Connected });

          return true;
        } catch {
          // device round-trip failed; fall through to the next retry attempt
        }

        return false;
      };

      /** @return {() => void} stops the loop without emitting anything */
      const runPollLoop = (loopBudget: number): (() => void) => {
        let timeoutLoops = loopBudget;

        const timer = setInterval(async () => {
          if (--timeoutLoops <= 0) {
            clearInterval(timer);
            subscriber.next({ status: LedgerEventStatus.Timeout });
          } else if (!this.#allowReconnect) {
            return;
          } else if (await retryConnection()) {
            clearInterval(timer);
            subscriber.complete();
          }
        }, CONNECTION_POLL_INTERVAL);

        return () => clearInterval(timer);
      };

      const fullLoopBudget = CONNECTION_TIMEOUT_MS / CONNECTION_POLL_INTERVAL;

      // Resolves from device-state transitions; the poll runs underneath for the same budget so
      // a silent, failing or non-decisive channel degrades to the status-word path.
      const waitOnStateChannel = (): void => {
        const stopPollLoop = runPollLoop(fullLoopBudget);
        let timeoutHandle: ReturnType<typeof setTimeout>;

        const stopWaiting = (after: () => void): void => {
          this.#connectionWaitHandlers = null;
          clearTimeout(timeoutHandle);
          stopPollLoop();
          after();
        };

        this.#connectionWaitHandlers = {
          onConnected: () => stopWaiting(() => subscriber.complete()),
          onChannelError: () => {
            // The poll underneath already owns the rest of the window; drop the channel's wait.
            this.#connectionWaitHandlers = null;
            clearTimeout(timeoutHandle);
          },
          cancel: () => stopWaiting(() => subscriber.complete()),
        };

        timeoutHandle = setTimeout(() => {
          stopWaiting(() => {
            this.#releaseTransport().catch(() => undefined);
            subscriber.next({ status: LedgerEventStatus.Timeout });
          });
        }, CONNECTION_TIMEOUT_MS);
      };

      if (this.#transport?.observeState) {
        if (this.#ledgerConnected) {
          subscriber.complete();
        } else {
          waitOnStateChannel();
        }
      } else {
        retryConnection().then(async shouldStopRetries => {
          if (shouldStopRetries) {
            subscriber.complete();
          } else {
            runPollLoop(fullLoopBudget);
          }
        });
      }
    });

    observable.pipe(distinct(({ status }) => status)).subscribe(observer);
  }

  /** @throws {LedgerError} message - ILedgerEvent JSON */
  #processError(evt: ILedgerEvent): never {
    this.#ledgerEventStatusSubject.next(evt);
    throw new LedgerError(evt);
  }

  /** Marks a device round-trip as in flight so a concurrent `connect()` cannot close it out. */
  async #exchange<T>(run: () => Promise<T> | undefined): Promise<T | undefined> {
    this.#exchangeDepth++;

    try {
      return await run();
    } finally {
      this.#exchangeDepth--;
    }
  }

  /** Bluetooth transports need a beat after a resolved promise before the next call. */
  async #processDelayAfterAction() {
    if (this.#isBluetoothTransport) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
}

export const createCasperLedgerService = (
  options: ICasperLedgerServiceOptions,
): ICasperLedgerService => new CasperLedgerService(options);
