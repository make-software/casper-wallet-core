import { blake2b } from '@noble/hashes/blake2';
import { HexBytes, PublicKey, Transaction } from 'casper-js-sdk';
import { BehaviorSubject, debounceTime, distinct, Observable, Observer, Subscription } from 'rxjs';

import {
  ICasperLedgerService,
  ICasperLedgerServiceOptions,
  ILedgerCasperApp,
  ILedgerEvent,
  ILedgerSignResponse,
  ILedgerTransport,
  LedgerAccount,
  LedgerAccountsOptions,
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

export class CasperLedgerService implements ICasperLedgerService {
  cachedAccounts: LedgerAccount[] = [];

  #transport: ILedgerTransport | null = null;
  #isBluetoothTransport: boolean = false;
  #ledgerApp: ILedgerCasperApp | null = null;
  #ledgerConnected = false;
  #allowReconnect: boolean = true;
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

  /** @throws {LedgerError} */
  async connect(
    transportCreator: TransportCreator,
    checkTransportAvailability: TransportAvailabilityCheck,
    isBluetoothTransport = false,
  ): Promise<void> {
    this.#isBluetoothTransport = isBluetoothTransport;

    return new Promise(async (resolve, reject) => {
      const available = await checkTransportAvailability();

      if (!available) {
        const evt = { status: LedgerEventStatus.NotAvailable };
        this.#ledgerEventStatusSubject.next(evt);
        reject(new LedgerError(evt));
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
          const evt: ILedgerEvent = {
            status: this.#options.isPairingInvalidatedError?.(e)
              ? LedgerEventStatus.BluetoothPairingInvalidated
              : LedgerEventStatus.ErrorOpeningDevice,
          };
          this.#ledgerEventStatusSubject.next(evt);
          reject(new LedgerError(evt));
        },
        complete: async () => {
          resolve();
        },
      };

      const tryToConnect = async (withRetry = true): Promise<void> => {
        try {
          this.#transport = await transportCreator();
          this.#transport?.on('disconnect', this.#onDisconnect);
          this.#ledgerApp = this.#createLedgerApp(this.#transport);
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
          const evt: ILedgerEvent = {
            status: this.#options.isPairingInvalidatedError?.(e)
              ? LedgerEventStatus.BluetoothPairingInvalidated
              : LedgerEventStatus.ErrorOpeningDevice,
          };
          this.#ledgerEventStatusSubject.next(evt);
          reject(new LedgerError(evt));
          return;
        }
      }

      this.#connectToLedger(transportCreator, connectionObserver);
    });
  }

  async disconnect(): Promise<boolean> {
    if (this.#ledgerConnected) {
      try {
        await this.#transport?.close();
        this.#ledgerEventStatusSubject.next({
          status: LedgerEventStatus.Disconnected,
        });
      } catch {
        // best-effort close; the device is being abandoned either way
      }

      this.#ledgerConnected = false;
    }

    this.cachedAccounts = [];

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
          this.#ledgerEventStatusSubject.next({
            status: LedgerEventStatus.DeviceLocked,
          });
        } else if (response?.returnCode === 0x6e01) {
          this.#ledgerEventStatusSubject.next({
            status: LedgerEventStatus.CasperAppNotLoaded,
          });
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

      if (appSupportsTransactionV1) {
        if (tx.getDeploy()?.session?.isModuleBytes()) {
          // in version 3. we still need to use signWasmDeploy for legacy WASM Deploys
          result = await this.#ledgerApp?.signWasmDeploy(
            this.#getAccountPath(account.index),
            Buffer.from(tx.toBytes()),
          );
        } else {
          const txBytes = tx.toBytes();
          result = await this.#ledgerApp?.sign(
            this.#getAccountPath(account.index),
            Buffer.from(txBytes),
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
          result = await this.#ledgerApp?.signWasmDeploy(
            this.#getAccountPath(account.index),
            Buffer.from(deploy.toBytes()),
          );
        } else {
          result = await this.#ledgerApp?.sign(
            this.#getAccountPath(account.index),
            Buffer.from(deploy.toBytes()),
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

      const result: ILedgerSignResponse | undefined = await this.#ledgerApp?.signMessage(
        this.#getAccountPath(account.index),
        prefixedMessage,
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

  #onDisconnect = () => {
    this.#ledgerConnected = false;
    this.#allowReconnect = false;
    this.cachedAccounts = [];
    this.#ledgerEventStatusSubject.next({
      status: LedgerEventStatus.Disconnected,
    });
    this.#transport?.off('disconnect', this.#onDisconnect);
    this.#transport = null;

    setTimeout(() => {
      this.#allowReconnect = true;
    }, CONNECTION_POLL_INTERVAL * 1.2);
  };

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

      retryConnection().then(async shouldStopRetries => {
        if (shouldStopRetries) {
          subscriber.complete();
        } else {
          let timeoutLoops = CONNECTION_TIMEOUT_MS / CONNECTION_POLL_INTERVAL;

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
        }
      });
    });

    observable.pipe(distinct(({ status }) => status)).subscribe(observer);
  }

  /** @throws {LedgerError} message - ILedgerEvent JSON */
  #processError(evt: ILedgerEvent): never {
    this.#ledgerEventStatusSubject.next(evt);
    throw new LedgerError(evt);
  }

  /** Even though the Promise is resolved, bluetooth has not had time to process the messages
   * We need to wait a bit due to errors
   * */
  async #processDelayAfterAction() {
    if (this.#isBluetoothTransport) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
}

export const createCasperLedgerService = (
  options: ICasperLedgerServiceOptions,
): ICasperLedgerService => new CasperLedgerService(options);
