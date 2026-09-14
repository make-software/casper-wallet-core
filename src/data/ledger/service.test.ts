import { blake2b } from '@noble/hashes/blake2';
import { KeyAlgorithm, PrivateKey, Transaction } from 'casper-js-sdk';
import { BehaviorSubject, config as rxjsConfig, Observable, Subject } from 'rxjs';

import { CasperLedgerService } from './service';
import {
  ICasperLedgerServiceOptions,
  ILedgerEvent,
  LEDGER_ERROR_STATUSES,
  LedgerDeviceState,
  LedgerError,
  LedgerEventStatus,
} from '../../domain';

jest.mock('../../utils/common', () => ({
  delay: jest.fn().mockResolvedValue(undefined),
}));

const CONNECTION_POLL_INTERVAL = 3000;
const CONNECTION_TIMEOUT_MS = 60000;

const REAL_KEY = PrivateKey.generate(KeyAlgorithm.SECP256K1);
const PUBLIC_KEY_HEX = REAL_KEY.publicKey.toHex();
const RAW_PUBLIC_KEY_BYTES = Buffer.from(PUBLIC_KEY_HEX.slice(2), 'hex');
const ACCOUNT = { publicKey: PUBLIC_KEY_HEX, index: 0 };

const okSign = (
  len = 64,
  overrides: Partial<{ returnCode: number; errorMessage: string }> = {},
) => ({
  returnCode: 0x9000,
  errorMessage: '',
  signatureRSV: Buffer.alloc(len, 7),
  ...overrides,
});

const okAppInfo = { returnCode: 0x9000, appName: 'Casper', appVersion: '3.0.5' };

// An unrecognized returnCode keeps the status-word path from settling on its own, so assertions
// can isolate the state channel's effect.
const undecidedAppInfo = { returnCode: 0x6f00, appName: 'Casper', appVersion: '3.0.5' };

const casperConnectedState: LedgerDeviceState = {
  status: 'connected',
  app: { name: 'Casper', version: '3.0.5' },
};

const makeFakeApp = (over: Partial<Record<string, unknown>> = {}) => ({
  getAppInfo: jest.fn(async () => okAppInfo),
  getAddressAndPubKey: jest.fn(async () => ({
    returnCode: 0x9000,
    publicKey: RAW_PUBLIC_KEY_BYTES,
  })),
  sign: jest.fn(async () => okSign()),
  signWasmDeploy: jest.fn(async () => okSign()),
  signMessage: jest.fn(async () => okSign()),
  ...over,
});

const makeTransport = (state?: Observable<LedgerDeviceState>) => ({
  on: jest.fn(),
  off: jest.fn(),
  close: jest.fn().mockResolvedValue(undefined),
  setExchangeTimeout: jest.fn(),
  ...(state ? { observeState: jest.fn(() => state) } : {}),
});

const connectService = async (
  app: ReturnType<typeof makeFakeApp>,
  options: Partial<ICasperLedgerServiceOptions> = {},
  isBluetoothTransport = false,
) => {
  const service = new CasperLedgerService({ createLedgerApp: () => app as never, ...options });
  const transport = makeTransport();
  await service.connect(
    async () => transport,
    async () => true,
    isBluetoothTransport,
  );
  return { service, transport };
};

const casperConnected = casperConnectedState;

const connectWithState = async (state: Subject<LedgerDeviceState>) => {
  const app = makeFakeApp({ getAppInfo: jest.fn(async () => undecidedAppInfo) });
  const service = new CasperLedgerService({ createLedgerApp: () => app as never });
  const transport = makeTransport(state.asObservable());

  service
    .connect(
      async () => transport,
      async () => true,
    )
    .catch(() => undefined);
  await flushMicrotasks();

  return { service, transport, app };
};

/** Collects every raw BehaviorSubject.next() payload, bypassing the debounceTime(300) pipe. */
const spyOnEvents = () => {
  const events: Array<{ status: LedgerEventStatus; [key: string]: unknown }> = [];
  const realNext = BehaviorSubject.prototype.next;
  const spy = jest.spyOn(BehaviorSubject.prototype, 'next').mockImplementation(function (
    this: BehaviorSubject<unknown>,
    value: unknown,
  ) {
    if (value != null && typeof value === 'object' && 'status' in value) {
      events.push(value as { status: LedgerEventStatus });
    }
    return realNext.call(this, value);
  });
  return { events, restore: () => spy.mockRestore() };
};

const flushMicrotasks = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
};

const makeTx = (over: { hash?: string; deploy?: unknown; bytes?: number[] } = {}) =>
  ({
    hash: { toHex: () => over.hash ?? 'deadbeef' },
    getDeploy: () => over.deploy,
    toBytes: () => new Uint8Array(over.bytes ?? [0x01, 0x02, 0x03]),
    setSignature: jest.fn(),
  }) as unknown as Transaction & { setSignature: jest.Mock };

const makeDeploy = (over: { isModuleBytes?: boolean; bytes?: number[] } = {}) => ({
  session: { isModuleBytes: () => over.isModuleBytes ?? false },
  toBytes: () => new Uint8Array(over.bytes ?? [0x0a, 0x0b]),
});

describe('CasperLedgerService', () => {
  describe('initial state', () => {
    it('is not connected and exposes an empty account cache', () => {
      const service = new CasperLedgerService({ createLedgerApp: () => makeFakeApp() as never });
      expect(service.isConnected).toBe(false);
      expect(service.cachedAccounts).toEqual([]);
    });
  });

  describe('version gate', () => {
    it('signs via the TransactionV1 path and reports supportsTransactionV1Cb(true) for a new app', async () => {
      const app = makeFakeApp();
      const { service } = await connectService(app);
      const tx = makeTx();
      const cb = jest.fn();

      await service.signTransaction(tx, ACCOUNT, cb);

      expect(app.sign).toHaveBeenCalledWith(expect.any(String), Buffer.from(tx.toBytes()));
      expect(cb).toHaveBeenCalledWith(ACCOUNT.publicKey, true);
    });

    it('signs the Deploy bytes and reports supportsTransactionV1Cb(false) for an old app', async () => {
      const app = makeFakeApp({
        getAppInfo: jest.fn(async () => ({ ...okAppInfo, appVersion: '2.4.0' })),
      });
      const { service } = await connectService(app);
      const deploy = makeDeploy();
      const tx = makeTx({ deploy });
      const cb = jest.fn();

      await service.signTransaction(tx, ACCOUNT, cb);

      expect(app.sign).toHaveBeenCalledWith(expect.any(String), Buffer.from(deploy.toBytes()));
      expect(cb).toHaveBeenCalledWith(ACCOUNT.publicKey, false);
    });

    it('treats a missing appVersion as "2" (old-app path)', async () => {
      const app = makeFakeApp({
        getAppInfo: jest.fn(async () => ({ ...okAppInfo, appVersion: undefined })),
      });
      const { service } = await connectService(app);
      const deploy = makeDeploy();
      const tx = makeTx({ deploy });
      const cb = jest.fn();

      await service.signTransaction(tx, ACCOUNT, cb);

      expect(app.sign).toHaveBeenCalledWith(expect.any(String), Buffer.from(deploy.toBytes()));
      expect(cb).toHaveBeenCalledWith(ACCOUNT.publicKey, false);
    });

    it('emits and throws TransactionForOldAppVersion for a 1.x-incapable tx on an old app', async () => {
      const app = makeFakeApp({
        getAppInfo: jest.fn(async () => ({ ...okAppInfo, appVersion: '2.4.0' })),
      });
      const { service } = await connectService(app);
      const tx = makeTx(); // getDeploy() -> undefined

      await expect(service.signTransaction(tx, ACCOUNT)).rejects.toMatchObject({
        message: expect.stringContaining(LedgerEventStatus.TransactionForOldAppVersion),
      });
    });

    it('uses signWasmDeploy for a legacy WASM deploy even on v3+ apps', async () => {
      const app = makeFakeApp();
      const { service } = await connectService(app);
      const deploy = makeDeploy({ isModuleBytes: true, bytes: [0xde, 0xad] });
      const tx = makeTx({ deploy, bytes: [0xca, 0xfe] });

      await service.signTransaction(tx, ACCOUNT);

      expect(app.signWasmDeploy).toHaveBeenCalledWith(
        expect.any(String),
        Buffer.from(tx.toBytes()),
      );
      expect(app.sign).not.toHaveBeenCalled();
    });
  });

  describe('getSignedTransaction', () => {
    it('attaches the signature to the original tx on a new app and resolves it', async () => {
      const app = makeFakeApp();
      const { service, transport } = await connectService(app);
      const tx = makeTx();

      const signed = await service.getSignedTransaction(tx, ACCOUNT);

      expect(signed).toBe(tx);
      expect(tx.setSignature).toHaveBeenCalledWith(expect.any(Uint8Array), expect.anything());
      expect(transport.setExchangeTimeout).not.toHaveBeenCalled();
    });

    it('signs and returns the fallback deploy tx on an old app', async () => {
      const app = makeFakeApp({
        getAppInfo: jest.fn(async () => ({ ...okAppInfo, appVersion: '2.4.0' })),
      });
      const { service } = await connectService(app);
      const deploy = makeDeploy();
      const tx = makeTx(); // v1-only tx: getDeploy() -> undefined
      const fallbackTx = makeTx({ deploy });

      const signed = await service.getSignedTransaction(tx, ACCOUNT, fallbackTx);

      expect(signed).toBe(fallbackTx);
      expect(fallbackTx.setSignature).toHaveBeenCalled();
      expect(tx.setSignature).not.toHaveBeenCalled();
    });

    it('throws TransactionForOldAppVersion when no fallback is supplied for an old app', async () => {
      const app = makeFakeApp({
        getAppInfo: jest.fn(async () => ({ ...okAppInfo, appVersion: '2.4.0' })),
      });
      const { service } = await connectService(app);
      const tx = makeTx();

      await expect(service.getSignedTransaction(tx, ACCOUNT)).rejects.toMatchObject({
        message: expect.stringContaining(LedgerEventStatus.TransactionForOldAppVersion),
      });
    });
  });

  describe('identity pre-flight (D4)', () => {
    it('fails with SignatureFailed when the on-device key does not match the account key', async () => {
      const app = makeFakeApp({
        getAddressAndPubKey: jest.fn(async () => ({
          returnCode: 0x9000,
          publicKey: Buffer.alloc(33, 0xff),
        })),
      });
      const { service } = await connectService(app);
      const tx = makeTx();

      await expect(service.signTransaction(tx, ACCOUNT)).rejects.toMatchObject({
        message: JSON.stringify({
          status: LedgerEventStatus.SignatureFailed,
          error: 'Signing key not found on Ledger device. Signature process failed',
          publicKey: ACCOUNT.publicKey,
          txHash: 'deadbeef',
        }),
      });
      expect(app.sign).not.toHaveBeenCalled();
    });
  });

  describe('user rejection', () => {
    it('rejects with SignatureCanceled on a 0x6986 return code (tx)', async () => {
      const app = makeFakeApp({ sign: jest.fn(async () => okSign(64, { returnCode: 0x6986 })) });
      const { service } = await connectService(app);
      const tx = makeTx();

      await expect(service.signTransaction(tx, ACCOUNT)).rejects.toMatchObject({
        message: expect.stringContaining(LedgerEventStatus.SignatureCanceled),
      });
    });

    it('rejects with MsgSignatureCanceled on a 0x6986 return code (message)', async () => {
      const app = makeFakeApp({
        signMessage: jest.fn(async () => okSign(64, { returnCode: 0x6986 })),
      });
      const { service } = await connectService(app);

      await expect(service.signMessage('hi', ACCOUNT)).rejects.toMatchObject({
        message: expect.stringContaining(LedgerEventStatus.MsgSignatureCanceled),
      });
    });
  });

  describe('other non-0x9000 return codes', () => {
    it('rejects with SignatureFailed and propagates the device errorMessage', async () => {
      const app = makeFakeApp({
        sign: jest.fn(async () => okSign(64, { returnCode: 0x6a80, errorMessage: 'boom' })),
      });
      const { service } = await connectService(app);
      const tx = makeTx();

      await expect(service.signTransaction(tx, ACCOUNT)).rejects.toMatchObject({
        message: JSON.stringify({
          status: LedgerEventStatus.SignatureFailed,
          error: 'boom',
          publicKey: ACCOUNT.publicKey,
          txHash: 'deadbeef',
        }),
      });
    });
  });

  describe('signature post-processing', () => {
    it('strips the V byte from a 65-byte RSV signature and prefixes 0x02', async () => {
      const app = makeFakeApp({ sign: jest.fn(async () => okSign(65)) });
      const { service } = await connectService(app);
      const tx = makeTx();

      const resp = await service.signTransaction(tx, ACCOUNT);

      expect(resp.signature).toHaveLength(64);
      expect(resp.prefixedSignature[0]).toBe(0x02);
      expect(resp.prefixedSignature).toHaveLength(65);
      expect(resp.prefixedSignatureHex).toBe(`02${resp.signatureHex}`);
      expect(resp.prefixedSignatureHex.startsWith('02')).toBe(true);
    });
  });

  describe('message signing', () => {
    it('hashes the prefixed message for display, signs raw prefixed bytes, and returns both signature variants', async () => {
      const app = makeFakeApp();
      const { service, transport } = await connectService(app);
      const { events, restore } = spyOnEvents();

      const result = await service.signMessage('msg', ACCOUNT);
      restore();

      const expectedPrefixed = Buffer.from('Casper Message:\nmsg', 'utf-8');
      const expectedHash = Buffer.from(blake2b(expectedPrefixed, { dkLen: 32 })).toString('hex');

      expect(app.signMessage).toHaveBeenCalledWith(expect.any(String), expectedPrefixed);
      expect(transport.setExchangeTimeout).toHaveBeenCalledWith(10000);
      expect(transport.setExchangeTimeout).toHaveBeenCalledTimes(1);
      expect(transport.setExchangeTimeout.mock.invocationCallOrder[0]).toBeLessThan(
        app.signMessage.mock.invocationCallOrder[0],
      );

      const requested = events.find(
        e => e.status === LedgerEventStatus.MsgSignatureRequestedToUser,
      );
      expect(requested?.msgHash).toBe(expectedHash);
      expect(result.signature).toHaveLength(64);
      expect(result.signatureHex).toBe('07'.repeat(64));
    });
  });

  describe('restore callback', () => {
    it('emits WaitingResponseFromDevice, awaits tryRestoreConnection, then re-checks the connection', async () => {
      const app = makeFakeApp();
      const service = new CasperLedgerService({ createLedgerApp: () => app as never });
      const tryRestoreConnection = jest.fn(async () => undefined);
      const { events, restore } = spyOnEvents();

      await expect(
        service.signTransaction(makeTx(), ACCOUNT, undefined, tryRestoreConnection),
      ).rejects.toBeInstanceOf(LedgerError);

      restore();
      expect(tryRestoreConnection).toHaveBeenCalled();
      expect(events.some(e => e.status === LedgerEventStatus.WaitingResponseFromDevice)).toBe(true);
    });

    it('does not forward tryRestoreConnection to the inner signTransaction call from getSignedTransaction', async () => {
      const app = makeFakeApp();
      const { service } = await connectService(app);
      const tx = makeTx();
      const tryRestoreConnection = jest.fn(async () => undefined);

      // Already connected, so the outer preamble is a no-op; asserts the flow still succeeds
      // and the callback is never invoked for the (already-connected) inner call.
      await service.getSignedTransaction(tx, ACCOUNT, undefined, undefined, tryRestoreConnection);

      expect(tryRestoreConnection).not.toHaveBeenCalled();
    });
  });

  describe('connection check', () => {
    it('rejects with InvalidIndex for a NaN account index', async () => {
      const service = new CasperLedgerService({ createLedgerApp: () => makeFakeApp() as never });

      await expect(
        service.signTransaction(makeTx(), { publicKey: ACCOUNT.publicKey, index: NaN }),
      ).rejects.toMatchObject({
        message: expect.stringContaining(LedgerEventStatus.InvalidIndex),
      });
    });

    it('does not attempt a transport when availability check fails', async () => {
      const service = new CasperLedgerService({ createLedgerApp: () => makeFakeApp() as never });
      const transportCreator = jest.fn(async () => makeTransport());

      await expect(
        service.connect(transportCreator as never, async () => false),
      ).rejects.toMatchObject({
        message: expect.stringContaining(LedgerEventStatus.NotAvailable),
      });

      expect(transportCreator).not.toHaveBeenCalled();
      expect(service.isConnected).toBe(false);
    });

    it('rejects with Disconnected when not connected', async () => {
      const service = new CasperLedgerService({ createLedgerApp: () => makeFakeApp() as never });

      await expect(service.signTransaction(makeTx(), ACCOUNT)).rejects.toMatchObject({
        message: expect.stringContaining(LedgerEventStatus.Disconnected),
      });
    });

    it('emits CasperAppNotLoaded when a non-Casper app is active on the device', async () => {
      jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
      const app = makeFakeApp({
        getAppInfo: jest.fn(async () => ({
          returnCode: 0x9000,
          appName: 'Ethereum',
          appVersion: '1.0.0',
        })),
      });
      const service = new CasperLedgerService({ createLedgerApp: () => app as never });
      const { events, restore } = spyOnEvents();

      // connect() never settles on this path (never reaches Connected nor a rejecting status).
      service
        .connect(
          async () => makeTransport(),
          async () => true,
        )
        .catch(() => undefined);
      await flushMicrotasks();
      restore();

      expect(events.some(e => e.status === LedgerEventStatus.CasperAppNotLoaded)).toBe(true);
      expect(service.isConnected).toBe(false);

      jest.clearAllTimers();
      jest.useRealTimers();
    });
  });

  describe('checkAppInfo', () => {
    const connectedWith = async (appInfo: Record<string, unknown>) => {
      const app = makeFakeApp();
      const { service } = await connectService(app);
      app.getAppInfo.mockResolvedValue(appInfo as never);
      return { service, app };
    };

    const lockedAppInfo = { returnCode: 21781, appName: 'Casper', appVersion: '3.0.0' };

    it('resolves DeviceLocked for returnCode 0x5515', async () => {
      const { service } = await connectedWith(lockedAppInfo);

      await expect(service.checkAppInfo()).resolves.toBe(LedgerEventStatus.DeviceLocked);
    });

    it('rejects with DeviceLocked and emits it when the connection check hits a locked device', async () => {
      const { service } = await connectedWith(lockedAppInfo);
      const { events, restore } = spyOnEvents();

      await expect(service.signTransaction(makeTx(), ACCOUNT)).rejects.toMatchObject({
        message: expect.stringContaining(LedgerEventStatus.DeviceLocked),
      });
      restore();

      expect(events.some(e => e.status === LedgerEventStatus.DeviceLocked)).toBe(true);
    });

    it('resolves null when the Casper app is open and idle', async () => {
      const { service } = await connectedWith(okAppInfo);

      await expect(service.checkAppInfo()).resolves.toBeNull();
    });

    it('resolves CasperAppNotLoaded when another app is open', async () => {
      const { service } = await connectedWith({
        returnCode: 0x9000,
        appName: 'Bitcoin',
        appVersion: '1.0.0',
      });

      await expect(service.checkAppInfo()).resolves.toBe(LedgerEventStatus.CasperAppNotLoaded);
    });

    it('resolves WaitingToSignPrevDeploy for returnCode 0xffff', async () => {
      const { service } = await connectedWith({
        returnCode: 0xffff,
        appName: 'Casper',
        appVersion: '3.0.0',
      });

      await expect(service.checkAppInfo()).resolves.toBe(LedgerEventStatus.WaitingToSignPrevDeploy);
    });

    it('resolves ErrorOpeningDevice for an unclassified status word', async () => {
      const { service } = await connectedWith({
        returnCode: 0x6f00,
        appName: 'Casper',
        appVersion: '3.0.0',
      });

      await expect(service.checkAppInfo()).resolves.toBe(LedgerEventStatus.ErrorOpeningDevice);
    });

    it('resolves Disconnected when connected without an app object', async () => {
      jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
      const state = new Subject<LedgerDeviceState>();
      const service = new CasperLedgerService({ createLedgerApp: () => null as never });

      service
        .connect(
          async () => makeTransport(state.asObservable()),
          async () => true,
        )
        .catch(() => undefined);
      await flushMicrotasks();
      state.next(casperConnected);
      await flushMicrotasks();

      expect(service.isConnected).toBe(true);
      await expect(service.checkAppInfo()).resolves.toBe(LedgerEventStatus.Disconnected);

      jest.clearAllTimers();
      jest.useRealTimers();
    });

    it('resolves Disconnected without calling getAppInfo when not connected', async () => {
      const app = makeFakeApp();
      const service = new CasperLedgerService({ createLedgerApp: () => app as never });

      await expect(service.checkAppInfo()).resolves.toBe(LedgerEventStatus.Disconnected);
      expect(app.getAppInfo).not.toHaveBeenCalled();
    });

    it('returns only error statuses, with Disconnected as the one exception', async () => {
      const app = makeFakeApp();
      const { service } = await connectService(app);
      const seen: LedgerEventStatus[] = [];

      // 'Bitcoin' keeps the 0x9000 row non-null, so every row contributes a status.
      for (const returnCode of [21781, 0x9000, 0xffff, 0x6f00]) {
        app.getAppInfo.mockResolvedValue({
          returnCode,
          appName: 'Bitcoin',
          appVersion: '3.0.0',
        } as never);
        const status = await service.checkAppInfo();
        if (status) seen.push(status);
      }

      await service.disconnect();
      const whileDisconnected = await service.checkAppInfo();
      if (whileDisconnected) seen.push(whileDisconnected);

      expect(seen).toHaveLength(5);
      expect(seen.filter(status => !LEDGER_ERROR_STATUSES.has(status))).toEqual([
        LedgerEventStatus.Disconnected,
      ]);
    });
  });

  describe('locked device', () => {
    it('emits DeviceLocked during connect when appInfo returnCode is 0xffff', async () => {
      jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
      const app = makeFakeApp({
        getAppInfo: jest.fn(async () => ({
          returnCode: 0xffff,
          appName: 'Casper',
          appVersion: '3.0.0',
        })),
      });
      const service = new CasperLedgerService({ createLedgerApp: () => app as never });
      const { events, restore } = spyOnEvents();

      // connect() never settles on this path (never reaches Connected nor a rejecting status).
      service
        .connect(
          async () => makeTransport(),
          async () => true,
        )
        .catch(() => undefined);
      await flushMicrotasks();
      restore();

      expect(events.some(e => e.status === LedgerEventStatus.DeviceLocked)).toBe(true);
      expect(service.isConnected).toBe(false);

      jest.clearAllTimers();
      jest.useRealTimers();
    });

    it('emits DeviceLocked during getAccountList when returnCode is 21781', async () => {
      const app = makeFakeApp({
        getAddressAndPubKey: jest.fn(async () => ({
          returnCode: 21781,
          publicKey: Buffer.alloc(33),
        })),
      });
      const { service } = await connectService(app);
      const { events, restore } = spyOnEvents();

      await expect(service.getAccountList({ size: 1, offset: 0 })).rejects.toBeInstanceOf(
        LedgerError,
      );
      restore();

      expect(events.some(e => e.status === LedgerEventStatus.DeviceLocked)).toBe(true);
      expect(events.some(e => e.status === LedgerEventStatus.AccountListUpdated)).toBe(false);
      expect(service.cachedAccounts).toHaveLength(0);
    });

    it('stops getAccountList when the Casper app is not loaded', async () => {
      const app = makeFakeApp({
        getAddressAndPubKey: jest.fn(async () => ({
          returnCode: 0x6e01,
          publicKey: Buffer.alloc(33),
        })),
      });
      const { service } = await connectService(app);
      const { events, restore } = spyOnEvents();

      await expect(service.getAccountList({ size: 1, offset: 0 })).rejects.toBeInstanceOf(
        LedgerError,
      );
      restore();

      expect(events.some(e => e.status === LedgerEventStatus.CasperAppNotLoaded)).toBe(true);
      expect(events.some(e => e.status === LedgerEventStatus.AccountListUpdated)).toBe(false);
      expect(service.cachedAccounts).toHaveLength(0);
    });

    it('checkAppInfo returns WaitingToSignPrevDeploy for returnCode 65535 (0xffff)', async () => {
      const app = makeFakeApp();
      const { service } = await connectService(app);
      app.getAppInfo.mockResolvedValueOnce({
        returnCode: 65535,
        appName: 'Casper',
        appVersion: '3.0.0',
      });

      await expect(service.checkAppInfo()).resolves.toBe(LedgerEventStatus.WaitingToSignPrevDeploy);
    });
  });

  describe('pairing invalidated', () => {
    it('emits BluetoothPairingInvalidated and rejects connect when the injected classifier matches', async () => {
      const app = makeFakeApp();
      const service = new CasperLedgerService({
        createLedgerApp: () => app as never,
        isPairingInvalidatedError: () => true,
      });
      const { events, restore } = spyOnEvents();

      await expect(
        service.connect(
          async () => {
            throw new Error('pairing dropped');
          },
          async () => true,
          true,
        ),
      ).rejects.toBeInstanceOf(LedgerError);
      restore();

      expect(events.some(e => e.status === LedgerEventStatus.BluetoothPairingInvalidated)).toBe(
        true,
      );
    });

    it('falls back to ErrorOpeningDevice when the classifier does not match', async () => {
      const app = makeFakeApp();
      const service = new CasperLedgerService({
        createLedgerApp: () => app as never,
        isPairingInvalidatedError: () => false,
      });
      const { events, restore } = spyOnEvents();

      await expect(
        service.connect(
          async () => {
            throw new Error('generic failure');
          },
          async () => true,
          true,
        ),
      ).rejects.toBeInstanceOf(LedgerError);
      restore();

      expect(events.some(e => e.status === LedgerEventStatus.ErrorOpeningDevice)).toBe(true);
      expect(events.some(e => e.status === LedgerEventStatus.BluetoothPairingInvalidated)).toBe(
        false,
      );
    });
  });

  describe('BLE settle delay', () => {
    it('schedules a 200ms settle delay after a round-trip only for bluetooth transport', async () => {
      const app = makeFakeApp();
      const { service: bleService } = await connectService(app, {}, true);

      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
      await bleService.checkAppInfo();
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 200);
      setTimeoutSpy.mockRestore();
    });

    it('does not add a settle delay for USB transport', async () => {
      const app = makeFakeApp();
      const { service: usbService } = await connectService(app, {}, false);

      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
      await usbService.checkAppInfo();
      expect(setTimeoutSpy).not.toHaveBeenCalledWith(expect.any(Function), 200);
      setTimeoutSpy.mockRestore();
    });
  });

  describe('event stream', () => {
    it('starts with Disconnected and delivers status updates debounced by 300ms', async () => {
      jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
      const service = new CasperLedgerService({ createLedgerApp: () => makeFakeApp() as never });
      const received: LedgerEventStatus[] = [];
      const sub = service.subscribeToLedgerEventStatus(evt => received.push(evt.status));

      await jest.advanceTimersByTimeAsync(300);
      expect(received).toEqual([LedgerEventStatus.Disconnected]);

      sub.unsubscribe();
      jest.useRealTimers();
    });

    it('deduplicates identical statuses via distinct() before they reach the observer', async () => {
      jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
      const app = makeFakeApp({
        getAppInfo: jest
          .fn()
          .mockResolvedValueOnce({ returnCode: 0x1234, appName: 'Casper', appVersion: '3.0.0' })
          .mockResolvedValueOnce(okAppInfo),
      });
      const service = new CasperLedgerService({ createLedgerApp: () => app as never });
      const { events, restore } = spyOnEvents();

      const connectPromise = service.connect(
        async () => makeTransport(),
        async () => true,
      );
      await flushMicrotasks();
      await jest.advanceTimersByTimeAsync(CONNECTION_POLL_INTERVAL);
      await connectPromise;
      restore();

      const waitingCount = events.filter(
        e => e.status === LedgerEventStatus.WaitingResponseFromDevice,
      ).length;
      expect(waitingCount).toBe(1);
      expect(service.isConnected).toBe(true);

      jest.useRealTimers();
    });
  });

  describe('ledgerEvents$', () => {
    it('replays the current event to a late subscriber', () => {
      const service = new CasperLedgerService({ createLedgerApp: () => makeFakeApp() as never });
      const seen: LedgerEventStatus[] = [];

      service.ledgerEvents$.subscribe(evt => seen.push(evt.status));

      expect(seen).toHaveLength(1);
    });

    it('emits without waiting out the callback path debounce', async () => {
      const app = makeFakeApp({
        getAddressAndPubKey: jest.fn(async () => ({
          returnCode: 21781,
          publicKey: Buffer.alloc(33),
        })),
      });
      const { service } = await connectService(app);
      const seen: LedgerEventStatus[] = [];

      service.ledgerEvents$.subscribe(evt => seen.push(evt.status));
      const before = seen.length;

      await expect(service.getAccountList({ size: 1, offset: 0 })).rejects.toBeInstanceOf(
        LedgerError,
      );

      expect(seen.length).toBeGreaterThan(before);
    });

    it('does not expose a publishing surface', () => {
      const service = new CasperLedgerService({ createLedgerApp: () => makeFakeApp() as never });

      expect((service.ledgerEvents$ as unknown as { next?: unknown }).next).toBeUndefined();
    });
  });

  describe('getAccountList', () => {
    it('fetches accounts sequentially, encodes them as hex, and caches the result', async () => {
      const app = makeFakeApp({
        getAddressAndPubKey: jest
          .fn()
          .mockResolvedValueOnce({ returnCode: 0x9000, publicKey: Buffer.from([0xaa]) })
          .mockResolvedValueOnce({ returnCode: 0x9000, publicKey: Buffer.from([0xbb]) }),
      });
      const { service, transport } = await connectService(app);
      const { events, restore } = spyOnEvents();

      await service.getAccountList({ size: 2, offset: 0 });
      restore();

      expect(app.getAddressAndPubKey).toHaveBeenNthCalledWith(1, "m/44'/506'/0'/0/0");
      expect(app.getAddressAndPubKey).toHaveBeenNthCalledWith(2, "m/44'/506'/0'/0/1");
      expect(transport.setExchangeTimeout).not.toHaveBeenCalled();

      const updated = events.find(e => e.status === LedgerEventStatus.AccountListUpdated);
      expect(updated?.accounts).toEqual([
        { publicKey: '02aa', index: 0 },
        { publicKey: '02bb', index: 1 },
      ]);
      expect(updated?.appVersion).toBe('3.0.5');
      expect(service.cachedAccounts).toEqual([
        { publicKey: '02aa', index: 0 },
        { publicKey: '02bb', index: 1 },
      ]);
    });

    it('emits AccountListFailed and throws for an unrecognized error return code', async () => {
      const app = makeFakeApp({
        getAddressAndPubKey: jest.fn(async () => ({
          returnCode: 0x6e00,
          publicKey: Buffer.alloc(0),
        })),
      });
      const { service } = await connectService(app);

      await expect(service.getAccountList({ size: 1, offset: 0 })).rejects.toBeInstanceOf(
        LedgerError,
      );
    });
  });

  describe('disconnect', () => {
    it('closes the transport once when connected', async () => {
      const { service, transport } = await connectService(makeFakeApp());

      await service.disconnect();

      expect(transport.close).toHaveBeenCalledTimes(1);
      expect(service.isConnected).toBe(false);
    });

    it('does not close anything when never connected', async () => {
      const service = new CasperLedgerService({ createLedgerApp: () => makeFakeApp() as never });
      const transport = makeTransport();

      await expect(service.disconnect()).resolves.toBe(true);
      expect(transport.close).not.toHaveBeenCalled();
    });

    it('swallows a rejecting close()', async () => {
      const { service, transport } = await connectService(makeFakeApp());
      transport.close.mockRejectedValueOnce(new Error('boom'));

      await expect(service.disconnect()).resolves.toBe(true);
      expect(transport.close).toHaveBeenCalledTimes(1);
    });

    it('is a no-op the second time it is called', async () => {
      const { service, transport } = await connectService(makeFakeApp());

      await service.disconnect();
      await service.disconnect();

      expect(transport.close).toHaveBeenCalledTimes(1);
    });

    it('clears cachedAccounts', async () => {
      const app = makeFakeApp({
        getAddressAndPubKey: jest.fn(async () => ({
          returnCode: 0x9000,
          publicKey: Buffer.from([0xaa]),
        })),
      });
      const { service } = await connectService(app);
      await service.getAccountList({ size: 1, offset: 0 });
      expect(service.cachedAccounts).not.toEqual([]);

      await service.disconnect();

      expect(service.cachedAccounts).toEqual([]);
    });

    it('closes and detaches a transport whose connect never reached "connected"', async () => {
      jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
      const state = new Subject<LedgerDeviceState>();
      const app = makeFakeApp({ getAppInfo: jest.fn(async () => undecidedAppInfo) });
      const service = new CasperLedgerService({ createLedgerApp: () => app as never });
      const transport = makeTransport(state.asObservable());

      service
        .connect(
          async () => transport,
          async () => true,
        )
        .catch(() => undefined);
      await flushMicrotasks();
      expect(service.isConnected).toBe(false);

      await service.disconnect();

      expect(transport.close).toHaveBeenCalledTimes(1);
      expect(transport.off).toHaveBeenCalledWith('disconnect', expect.any(Function));

      jest.clearAllTimers();
      jest.useRealTimers();
    });
  });

  const captureDisconnectHandler = (transport: ReturnType<typeof makeTransport>) => {
    const call = transport.on.mock.calls.find(([event]) => event === 'disconnect');
    if (!call) throw new Error('no disconnect listener was registered');
    return call[1] as () => void;
  };

  describe('disconnect listener', () => {
    beforeEach(() => {
      jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.useRealTimers();
    });

    it('registers exactly one disconnect listener on connect', async () => {
      const { transport } = await connectService(makeFakeApp());

      expect(transport.on).toHaveBeenCalledTimes(1);
      expect(transport.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    });

    it('never registers a listener for any event other than disconnect', async () => {
      const { transport } = await connectService(makeFakeApp());

      expect(transport.on.mock.calls.every(([event]) => event === 'disconnect')).toBe(true);
    });

    it('unregisters itself with the exact handler reference it registered', async () => {
      const { transport } = await connectService(makeFakeApp());
      const handler = captureDisconnectHandler(transport);

      handler();

      expect(transport.off).toHaveBeenCalledWith('disconnect', handler);
    });

    it('clears isConnected when the handler fires', async () => {
      const { service, transport } = await connectService(makeFakeApp());
      const handler = captureDisconnectHandler(transport);

      handler();

      expect(service.isConnected).toBe(false);
    });

    it('emits a Disconnected event when the handler fires', async () => {
      const { transport } = await connectService(makeFakeApp());
      const handler = captureDisconnectHandler(transport);
      const { events, restore } = spyOnEvents();

      handler();
      restore();

      expect(events.some(e => e.status === LedgerEventStatus.Disconnected)).toBe(true);
    });

    it('clears cachedAccounts when the handler fires', async () => {
      const app = makeFakeApp({
        getAddressAndPubKey: jest.fn(async () => ({
          returnCode: 0x9000,
          publicKey: Buffer.from([0xaa]),
        })),
      });
      const { service, transport } = await connectService(app);
      await service.getAccountList({ size: 1, offset: 0 });
      expect(service.cachedAccounts).not.toEqual([]);
      const handler = captureDisconnectHandler(transport);

      handler();

      expect(service.cachedAccounts).toEqual([]);
    });

    describe('reconnect suppression window', () => {
      it('suppresses a reconnect attempt inside the 3600ms window', async () => {
        const app = makeFakeApp({
          getAppInfo: jest.fn(async () => ({
            returnCode: 0x9000,
            appName: 'Ethereum',
            appVersion: '1.0.0',
          })),
        });
        const service = new CasperLedgerService({ createLedgerApp: () => app as never });
        const transports: Array<ReturnType<typeof makeTransport>> = [];
        const transportCreator = jest.fn(async () => {
          const transport = makeTransport();
          transports.push(transport);
          return transport;
        });

        service.connect(transportCreator, async () => true).catch(() => undefined);
        await flushMicrotasks();
        captureDisconnectHandler(transports[0])();

        await jest.advanceTimersByTimeAsync(CONNECTION_POLL_INTERVAL);

        expect(transportCreator).toHaveBeenCalledTimes(1);
      });

      it('allows a reconnect attempt once the 3600ms window has elapsed', async () => {
        const app = makeFakeApp({
          getAppInfo: jest.fn(async () => ({
            returnCode: 0x9000,
            appName: 'Ethereum',
            appVersion: '1.0.0',
          })),
        });
        const service = new CasperLedgerService({ createLedgerApp: () => app as never });
        const transports: Array<ReturnType<typeof makeTransport>> = [];
        const transportCreator = jest.fn(async () => {
          const transport = makeTransport();
          transports.push(transport);
          return transport;
        });

        service.connect(transportCreator, async () => true).catch(() => undefined);
        await flushMicrotasks();
        captureDisconnectHandler(transports[0])();

        await jest.advanceTimersByTimeAsync(CONNECTION_POLL_INTERVAL * 2);

        expect(transportCreator).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('device state channel', () => {
    beforeEach(() => {
      jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.useRealTimers();
    });

    it('raises DeviceLocked without an extra getAppInfo call (row 1)', async () => {
      const state = new Subject<LedgerDeviceState>();
      const { app } = await connectWithState(state);
      const callsBefore = app.getAppInfo.mock.calls.length;
      const { events, restore } = spyOnEvents();

      state.next({ status: 'locked' });
      await flushMicrotasks();
      restore();

      expect(events.some(e => e.status === LedgerEventStatus.DeviceLocked)).toBe(true);
      expect(app.getAppInfo.mock.calls.length).toBe(callsBefore);
    });

    it('emits Connected and sets isConnected for a connected state naming Casper (row 2)', async () => {
      const state = new Subject<LedgerDeviceState>();
      const { service } = await connectWithState(state);
      const { events, restore } = spyOnEvents();

      state.next(casperConnected);
      await flushMicrotasks();
      restore();

      expect(events.some(e => e.status === LedgerEventStatus.Connected)).toBe(true);
      expect(service.isConnected).toBe(true);
    });

    it('emits CasperAppNotLoaded and leaves isConnected false for a connected state naming another app (row 3)', async () => {
      const state = new Subject<LedgerDeviceState>();
      const { service } = await connectWithState(state);
      const { events, restore } = spyOnEvents();

      state.next({ status: 'connected', app: { name: 'Bitcoin', version: '2.0.0' } });
      await flushMicrotasks();
      restore();

      expect(events.some(e => e.status === LedgerEventStatus.CasperAppNotLoaded)).toBe(true);
      expect(service.isConnected).toBe(false);
    });

    it('falls back to getAppInfo for a connected state with no app identity (row 4)', async () => {
      const state = new Subject<LedgerDeviceState>();
      const app = makeFakeApp();
      const service = new CasperLedgerService({ createLedgerApp: () => app as never });
      const transport = makeTransport(state.asObservable());
      const connectPromise = service.connect(
        async () => transport,
        async () => true,
      );
      await flushMicrotasks();
      const { events, restore } = spyOnEvents();

      state.next({ status: 'connected' });
      await flushMicrotasks();

      expect(app.getAppInfo).not.toHaveBeenCalled();
      expect(events.some(e => e.status === LedgerEventStatus.DeviceLocked)).toBe(false);
      expect(events.some(e => e.status === LedgerEventStatus.CasperAppNotLoaded)).toBe(false);
      expect(events.some(e => e.status === LedgerEventStatus.Connected)).toBe(false);
      expect(service.isConnected).toBe(false);

      await jest.advanceTimersByTimeAsync(CONNECTION_POLL_INTERVAL);
      restore();

      await expect(connectPromise).resolves.toBeUndefined();
      expect(app.getAppInfo).toHaveBeenCalled();
      expect(service.isConnected).toBe(true);
      expect(events.some(e => e.status === LedgerEventStatus.Connected)).toBe(true);
    });

    it('routes a channel error to the fallback instead of rxjs unhandled-error reporting (row 6)', async () => {
      const unhandled: unknown[] = [];
      const previousHandler = rxjsConfig.onUnhandledError;
      rxjsConfig.onUnhandledError = e => {
        unhandled.push(e);
      };

      try {
        const state = new Subject<LedgerDeviceState>();
        const { service } = await connectWithState(state);

        state.error(new Error('boom'));
        await jest.advanceTimersByTimeAsync(0);

        expect(unhandled).toEqual([]);
        expect(service.isConnected).toBe(false);
      } finally {
        rxjsConfig.onUnhandledError = previousHandler;
      }
    });

    it('unsubscribes on disconnect() so a later emission raises no event (row 7)', async () => {
      const state = new Subject<LedgerDeviceState>();
      const { service } = await connectWithState(state);
      await service.disconnect();
      const { events, restore } = spyOnEvents();

      state.next({ status: 'locked' });
      await flushMicrotasks();
      restore();

      expect(events.some(e => e.status === LedgerEventStatus.DeviceLocked)).toBe(false);
    });

    it('unsubscribes the replaced transport on a second connect() (row 8)', async () => {
      const firstState = new Subject<LedgerDeviceState>();
      const secondState = new Subject<LedgerDeviceState>();
      const app = makeFakeApp();
      const service = new CasperLedgerService({ createLedgerApp: () => app as never });

      const firstConnect = service.connect(
        async () => makeTransport(firstState.asObservable()),
        async () => true,
      );
      await flushMicrotasks();
      firstState.next(casperConnected);
      await firstConnect;

      const secondConnect = service.connect(
        async () => makeTransport(secondState.asObservable()),
        async () => true,
      );
      await flushMicrotasks();
      secondState.next(casperConnected);
      await secondConnect;

      const { events, restore } = spyOnEvents();
      firstState.next({ status: 'locked' });
      await flushMicrotasks();
      restore();

      expect(events.some(e => e.status === LedgerEventStatus.DeviceLocked)).toBe(false);
    });

    it('closes the session when the channel reports it disconnected', async () => {
      const state = new Subject<LedgerDeviceState>();
      const { transport } = await connectWithState(state);

      state.next({ status: 'disconnected' });
      await flushMicrotasks();

      expect(transport.close).toHaveBeenCalledTimes(1);
      expect(transport.off).toHaveBeenCalledWith('disconnect', expect.any(Function));
    });

    it('does not close the transport when its own disconnect event fires', async () => {
      const state = new Subject<LedgerDeviceState>();
      const { transport } = await connectWithState(state);

      captureDisconnectHandler(transport)();
      await flushMicrotasks();

      expect(transport.close).not.toHaveBeenCalled();
    });

    it('ignores a channel that emits for a transport the service has already dropped', async () => {
      const app = makeFakeApp({ getAppInfo: jest.fn(async () => undecidedAppInfo) });
      const service = new CasperLedgerService({ createLedgerApp: () => app as never });
      // A BehaviorSubject emits during subscribe(), before the subscription is stored.
      const firstState = new BehaviorSubject<LedgerDeviceState>({ status: 'disconnected' });
      const creator = jest
        .fn()
        .mockImplementationOnce(async () => makeTransport(firstState.asObservable()))
        .mockImplementation(async () => makeTransport());

      service.connect(creator, async () => true).catch(() => undefined);
      await flushMicrotasks();

      const { events, restore } = spyOnEvents();
      firstState.next(casperConnected);
      await flushMicrotasks();
      restore();

      expect(service.isConnected).toBe(false);
      expect(events.some(e => e.status === LedgerEventStatus.Connected)).toBe(false);
    });

    it('does not double-fire Disconnected when the channel reports it after #onDisconnect already ran (row 9)', async () => {
      const state = new Subject<LedgerDeviceState>();
      const { transport } = await connectWithState(state);
      const handler = captureDisconnectHandler(transport);
      const { events, restore } = spyOnEvents();

      handler();
      state.next({ status: 'disconnected' });
      await flushMicrotasks();
      restore();

      expect(events.filter(e => e.status === LedgerEventStatus.Disconnected)).toHaveLength(1);
    });

    it('emits exactly one Connected event for three identical connected states', async () => {
      const state = new Subject<LedgerDeviceState>();
      const { service } = await connectWithState(state);
      const { events, restore } = spyOnEvents();

      state.next(casperConnected);
      state.next(casperConnected);
      state.next(casperConnected);
      await flushMicrotasks();
      restore();

      expect(events.filter(e => e.status === LedgerEventStatus.Connected)).toHaveLength(1);
      expect(service.isConnected).toBe(true);
    });

    it('emits exactly one Connected event across a connected/busy/connected poll cycle', async () => {
      const state = new Subject<LedgerDeviceState>();
      const { service } = await connectWithState(state);
      const { events, restore } = spyOnEvents();

      state.next(casperConnected);
      state.next({ status: 'busy' });
      state.next(casperConnected);
      await flushMicrotasks();
      restore();

      expect(events.filter(e => e.status === LedgerEventStatus.Connected)).toHaveLength(1);
      expect(service.isConnected).toBe(true);
    });

    it('ignores a busy state after a connected state', async () => {
      const state = new Subject<LedgerDeviceState>();
      const { service, app } = await connectWithState(state);
      state.next(casperConnected);
      await flushMicrotasks();
      const callsBefore = app.getAppInfo.mock.calls.length;
      const { events, restore } = spyOnEvents();

      state.next({ status: 'busy' });
      await flushMicrotasks();
      restore();

      expect(events).toHaveLength(0);
      expect(service.isConnected).toBe(true);
      expect(app.getAppInfo.mock.calls.length).toBe(callsBefore);
    });

    it('ignores an unknown state after a connected state', async () => {
      const state = new Subject<LedgerDeviceState>();
      const { service, app } = await connectWithState(state);
      state.next(casperConnected);
      await flushMicrotasks();
      const callsBefore = app.getAppInfo.mock.calls.length;
      const { events, restore } = spyOnEvents();

      state.next({ status: 'unknown' });
      await flushMicrotasks();
      restore();

      expect(events).toHaveLength(0);
      expect(service.isConnected).toBe(true);
      expect(app.getAppInfo.mock.calls.length).toBe(callsBefore);
    });
  });

  describe('connection wait driven by device state', () => {
    it('resolves connect() from state transitions without ever polling getAppInfo (row 1)', async () => {
      const state = new Subject<LedgerDeviceState>();
      const app = makeFakeApp();
      const service = new CasperLedgerService({ createLedgerApp: () => app as never });
      const transport = makeTransport(state.asObservable());

      const connectPromise = service.connect(
        async () => transport,
        async () => true,
      );
      await flushMicrotasks();

      state.next({ status: 'locked' });
      state.next({ status: 'connected', app: { name: 'Casper', version: '3.0.5' } });
      await connectPromise;

      expect(service.isConnected).toBe(true);
      expect(app.getAppInfo).not.toHaveBeenCalled();
    });

    it('gives up after CONNECTION_TIMEOUT_MS and rejects with Timeout when neither the channel nor the poll can decide (row 3)', async () => {
      jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
      const state = new Subject<LedgerDeviceState>();
      const app = makeFakeApp({ getAppInfo: jest.fn(async () => undecidedAppInfo) });
      const service = new CasperLedgerService({ createLedgerApp: () => app as never });
      const transport = makeTransport(state.asObservable());
      const { events, restore } = spyOnEvents();

      const connectPromise = service.connect(
        async () => transport,
        async () => true,
      );
      connectPromise.catch(() => undefined); // marks the eventual rejection handled before the timer fires
      await flushMicrotasks();

      await jest.advanceTimersByTimeAsync(CONNECTION_TIMEOUT_MS);
      restore();

      await expect(connectPromise).rejects.toMatchObject({
        message: expect.stringContaining(LedgerEventStatus.Timeout),
      });
      expect(events.some(e => e.status === LedgerEventStatus.Timeout)).toBe(true);

      jest.clearAllTimers();
      jest.useRealTimers();
    });

    it('tears down the state subscription and releases the transport when the wait times out', async () => {
      jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
      const state = new Subject<LedgerDeviceState>();
      const app = makeFakeApp({ getAppInfo: jest.fn(async () => undecidedAppInfo) });
      const service = new CasperLedgerService({ createLedgerApp: () => app as never });
      const transport = makeTransport(state.asObservable());

      service
        .connect(
          async () => transport,
          async () => true,
        )
        .catch(() => undefined);
      await flushMicrotasks();
      await jest.advanceTimersByTimeAsync(CONNECTION_TIMEOUT_MS);

      expect(transport.close).toHaveBeenCalledTimes(1);

      const { events, restore } = spyOnEvents();
      state.next({ status: 'connected', app: { name: 'Casper', version: '3.0.5' } });
      await flushMicrotasks();
      restore();

      expect(service.isConnected).toBe(false);
      expect(events).toHaveLength(0);

      jest.clearAllTimers();
      jest.useRealTimers();
    });

    it('honours the reconnection gate, then recovers through the poll once it reopens (row 4)', async () => {
      jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
      const state = new Subject<LedgerDeviceState>();
      const app = makeFakeApp();
      const service = new CasperLedgerService({ createLedgerApp: () => app as never });
      const transportCreator = jest.fn(async () => makeTransport(state.asObservable()));
      const { events, restore } = spyOnEvents();

      const connectPromise = service.connect(transportCreator, async () => true);
      await flushMicrotasks();
      captureDisconnectHandler(await transportCreator.mock.results[0].value)();
      await flushMicrotasks();

      state.next({ status: 'connected', app: { name: 'Casper', version: '3.0.5' } });
      await flushMicrotasks();

      expect(service.isConnected).toBe(false);
      expect(app.getAppInfo).not.toHaveBeenCalled();
      expect(events.some(e => e.status === LedgerEventStatus.Connected)).toBe(false);

      await jest.advanceTimersByTimeAsync(CONNECTION_POLL_INTERVAL * 2);
      restore();

      await expect(connectPromise).resolves.toBeUndefined();
      expect(transportCreator).toHaveBeenCalledTimes(2);
      expect(service.isConnected).toBe(true);

      jest.clearAllTimers();
      jest.useRealTimers();
    });

    it('replays a connected state that arrived while the gate was shut, once it reopens', async () => {
      jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
      const first = new Subject<LedgerDeviceState>();
      const second = new Subject<LedgerDeviceState>();
      const app = makeFakeApp({ getAppInfo: jest.fn(async () => undecidedAppInfo) });
      const service = new CasperLedgerService({ createLedgerApp: () => app as never });
      const firstTransport = makeTransport(first.asObservable());

      const firstConnect = service.connect(
        async () => firstTransport,
        async () => true,
      );
      await flushMicrotasks();
      first.next(casperConnectedState);
      await firstConnect;

      captureDisconnectHandler(firstTransport)();
      await flushMicrotasks();

      const secondConnect = service.connect(
        async () => makeTransport(second.asObservable()),
        async () => true,
      );
      await flushMicrotasks();
      const { events, restore } = spyOnEvents();

      second.next(casperConnectedState);
      await flushMicrotasks();

      expect(service.isConnected).toBe(false);
      expect(events.some(e => e.status === LedgerEventStatus.Connected)).toBe(false);

      await jest.advanceTimersByTimeAsync(CONNECTION_POLL_INTERVAL * 1.2);
      restore();

      await expect(secondConnect).resolves.toBeUndefined();
      expect(service.isConnected).toBe(true);
      expect(events.some(e => e.status === LedgerEventStatus.Connected)).toBe(true);

      jest.clearAllTimers();
      jest.useRealTimers();
    });

    it('emits DeviceLocked while waiting on the channel and keeps the attempt open (row 5)', async () => {
      const state = new Subject<LedgerDeviceState>();
      const app = makeFakeApp();
      const service = new CasperLedgerService({ createLedgerApp: () => app as never });
      const transport = makeTransport(state.asObservable());
      const connectPromise = service.connect(
        async () => transport,
        async () => true,
      );
      await flushMicrotasks();
      const { events, restore } = spyOnEvents();

      state.next({ status: 'locked' });
      await flushMicrotasks();
      restore();

      expect(events.some(e => e.status === LedgerEventStatus.DeviceLocked)).toBe(true);
      expect(service.isConnected).toBe(false);
      expect(app.getAppInfo).not.toHaveBeenCalled();

      state.next({ status: 'connected', app: { name: 'Casper', version: '3.0.5' } });
      await connectPromise;

      expect(service.isConnected).toBe(true);
    });

    it('emits CasperAppNotLoaded while waiting on the channel and keeps the attempt open (row 6)', async () => {
      const state = new Subject<LedgerDeviceState>();
      const app = makeFakeApp();
      const service = new CasperLedgerService({ createLedgerApp: () => app as never });
      const transport = makeTransport(state.asObservable());
      const connectPromise = service.connect(
        async () => transport,
        async () => true,
      );
      await flushMicrotasks();
      const { events, restore } = spyOnEvents();

      state.next({ status: 'connected', app: { name: 'Ethereum', version: '1.0.0' } });
      await flushMicrotasks();
      restore();

      expect(events.some(e => e.status === LedgerEventStatus.CasperAppNotLoaded)).toBe(true);
      expect(service.isConnected).toBe(false);
      expect(app.getAppInfo).not.toHaveBeenCalled();

      state.next({ status: 'connected', app: { name: 'Casper', version: '3.0.5' } });
      await connectPromise;

      expect(service.isConnected).toBe(true);
    });

    it('settles the connect promise and fires no belated Timeout when disconnect() cancels the wait (row 7)', async () => {
      jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
      const state = new Subject<LedgerDeviceState>();
      const app = makeFakeApp({ getAppInfo: jest.fn(async () => undecidedAppInfo) });
      const service = new CasperLedgerService({ createLedgerApp: () => app as never });
      const transport = makeTransport(state.asObservable());

      const connectPromise = service.connect(
        async () => transport,
        async () => true,
      );
      await flushMicrotasks();

      await service.disconnect();

      await expect(connectPromise).resolves.toBeUndefined();

      const { events, restore } = spyOnEvents();
      await jest.advanceTimersByTimeAsync(CONNECTION_TIMEOUT_MS);
      restore();

      expect(events).toHaveLength(0);

      jest.clearAllTimers();
      jest.useRealTimers();
    });

    it('leaves the connect latch usable after a cancelled wait', async () => {
      jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
      const state = new Subject<LedgerDeviceState>();
      const app = makeFakeApp({ getAppInfo: jest.fn(async () => undecidedAppInfo) });
      const service = new CasperLedgerService({ createLedgerApp: () => app as never });
      const transportCreator = jest.fn(async () => makeTransport(state.asObservable()));

      const firstConnect = service.connect(transportCreator, async () => true);
      await flushMicrotasks();
      await service.disconnect();
      await expect(firstConnect).resolves.toBeUndefined();

      const secondConnect = service.connect(transportCreator, async () => true);
      await flushMicrotasks();

      expect(transportCreator).toHaveBeenCalledTimes(2);

      state.next(casperConnectedState);
      await expect(secondConnect).resolves.toBeUndefined();

      jest.clearAllTimers();
      jest.useRealTimers();
    });

    it('lets the poll carry the rest of the window when the channel errors mid-wait (row 8)', async () => {
      jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
      const state = new Subject<LedgerDeviceState>();
      const getAppInfo = jest.fn(async () => undecidedAppInfo as typeof okAppInfo);
      const app = makeFakeApp({ getAppInfo });
      const service = new CasperLedgerService({ createLedgerApp: () => app as never });
      const transport = makeTransport(state.asObservable());

      const connectPromise = service.connect(
        async () => transport,
        async () => true,
      );
      await flushMicrotasks();

      await jest.advanceTimersByTimeAsync(CONNECTION_TIMEOUT_MS / 2);
      state.error(new Error('channel died'));
      await flushMicrotasks();

      // The device only becomes decidable near the end of the original window; a truncated
      // fallback budget would have given up long before.
      await jest.advanceTimersByTimeAsync(CONNECTION_TIMEOUT_MS / 2 - CONNECTION_POLL_INTERVAL * 2);
      getAppInfo.mockResolvedValue(okAppInfo);
      await jest.advanceTimersByTimeAsync(CONNECTION_POLL_INTERVAL);

      await expect(connectPromise).resolves.toBeUndefined();
      expect(service.isConnected).toBe(true);

      jest.clearAllTimers();
      jest.useRealTimers();
    });
  });

  describe('transport replacement', () => {
    it('closes nothing on the first connect', async () => {
      const transport = makeTransport();
      const service = new CasperLedgerService({ createLedgerApp: () => makeFakeApp() as never });

      await service.connect(
        async () => transport,
        async () => true,
      );

      expect(transport.close).not.toHaveBeenCalled();
    });

    it('closes the first transport before creating the second', async () => {
      const order: string[] = [];
      const first = makeTransport();
      first.close.mockImplementation(async () => void order.push('close-first'));
      const second = makeTransport();
      const creator = jest
        .fn()
        .mockImplementationOnce(async () => first)
        .mockImplementationOnce(async () => {
          order.push('create-second');
          return second;
        });
      const service = new CasperLedgerService({ createLedgerApp: () => makeFakeApp() as never });

      await service.connect(creator, async () => true);
      await service.connect(creator, async () => true);

      expect(order).toEqual(['close-first', 'create-second']);
    });

    it('detaches the first transport listener with the same handler reference it registered', async () => {
      const first = makeTransport();
      const second = makeTransport();
      const creator = jest
        .fn()
        .mockImplementationOnce(async () => first)
        .mockImplementationOnce(async () => second);
      const service = new CasperLedgerService({ createLedgerApp: () => makeFakeApp() as never });

      await service.connect(creator, async () => true);
      const handler = captureDisconnectHandler(first);
      await service.connect(creator, async () => true);

      expect(first.off).toHaveBeenCalledWith('disconnect', handler);
    });

    it('completes the second connect even when the first close() rejects', async () => {
      const first = makeTransport();
      first.close.mockRejectedValueOnce(new Error('boom'));
      const second = makeTransport();
      const creator = jest
        .fn()
        .mockImplementationOnce(async () => first)
        .mockImplementationOnce(async () => second);
      const service = new CasperLedgerService({ createLedgerApp: () => makeFakeApp() as never });

      await service.connect(creator, async () => true);
      await expect(service.connect(creator, async () => true)).resolves.toBeUndefined();

      expect(service.isConnected).toBe(true);
    });

    it('routes subsequent calls only to the second transport, not the replaced one', async () => {
      const first = makeTransport();
      const second = makeTransport();
      const creator = jest
        .fn()
        .mockImplementationOnce(async () => first)
        .mockImplementationOnce(async () => second);
      const app1 = makeFakeApp();
      const app2 = makeFakeApp();
      const appByTransport = new Map<unknown, ReturnType<typeof makeFakeApp>>([
        [first, app1],
        [second, app2],
      ]);
      const service = new CasperLedgerService({
        createLedgerApp: transport => appByTransport.get(transport) as never,
      });

      await service.connect(creator, async () => true);
      await service.connect(creator, async () => true);
      await service.signMessage('msg', ACCOUNT);

      expect(second.setExchangeTimeout).toHaveBeenCalledWith(10000);
      expect(first.setExchangeTimeout).not.toHaveBeenCalled();
      expect(app2.signMessage).toHaveBeenCalled();
      expect(app1.signMessage).not.toHaveBeenCalled();
    });

    it('clears isConnected when the replacement transport cannot be created', async () => {
      const first = makeTransport();
      const creator = jest
        .fn()
        .mockImplementationOnce(async () => first)
        .mockImplementation(async () => {
          throw new Error('no device');
        });
      const service = new CasperLedgerService({ createLedgerApp: () => makeFakeApp() as never });

      await service.connect(creator, async () => true);
      expect(service.isConnected).toBe(true);

      await expect(service.connect(creator, async () => true)).rejects.toBeInstanceOf(LedgerError);

      expect(first.close).toHaveBeenCalledTimes(1);
      expect(service.isConnected).toBe(false);
    });

    it('does not create or close a transport on a poll tick that already has one', async () => {
      jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
      const transport = makeTransport();
      const creator = jest.fn(async () => transport);
      const app = makeFakeApp({
        getAppInfo: jest.fn(async () => ({ ...okAppInfo, returnCode: 0xffff })),
      });
      const service = new CasperLedgerService({ createLedgerApp: () => app as never });

      service.connect(creator, async () => true).catch(() => undefined);
      await flushMicrotasks();
      await jest.advanceTimersByTimeAsync(CONNECTION_POLL_INTERVAL * 2);

      expect(app.getAppInfo.mock.calls.length).toBeGreaterThan(1);
      expect(creator).toHaveBeenCalledTimes(1);
      expect(transport.close).not.toHaveBeenCalled();

      jest.clearAllTimers();
      jest.useRealTimers();
    });

    it('leaves a transport that is mid-exchange alone when a connect arrives', async () => {
      let releaseSign: (value: ReturnType<typeof okSign>) => void = () => undefined;
      const app = makeFakeApp({
        sign: jest.fn(() => new Promise(resolve => (releaseSign = resolve))),
      });
      const first = makeTransport();
      const second = makeTransport();
      const creator = jest
        .fn()
        .mockImplementationOnce(async () => first)
        .mockImplementationOnce(async () => second);
      const service = new CasperLedgerService({ createLedgerApp: () => app as never });

      await service.connect(creator, async () => true);

      const signPromise = service.signTransaction(makeTx(), ACCOUNT);
      for (let i = 0; i < 50 && !app.sign.mock.calls.length; i++) {
        await Promise.resolve();
      }
      expect(app.sign).toHaveBeenCalled();

      await service.connect(creator, async () => true);

      expect(first.close).not.toHaveBeenCalled();
      expect(creator).toHaveBeenCalledTimes(1);

      releaseSign(okSign());
      await expect(signPromise).resolves.toMatchObject({ signatureHex: expect.any(String) });
    });
  });

  describe('concurrent connect attempts', () => {
    it('shares one in-flight attempt between two concurrent connects', async () => {
      const creator = jest.fn().mockResolvedValue(makeTransport());
      const available = jest.fn().mockResolvedValue(true);
      const service = new CasperLedgerService({ createLedgerApp: () => makeFakeApp() as never });

      const first = service.connect(creator, available);
      const second = service.connect(creator, available);

      await Promise.all([first, second]);

      expect(creator).toHaveBeenCalledTimes(1);
    });

    it('fails both concurrent callers from one shared failed attempt', async () => {
      const creator = jest.fn().mockRejectedValue(new Error('boom'));
      const available = jest.fn().mockResolvedValue(true);
      const service = new CasperLedgerService({ createLedgerApp: () => makeFakeApp() as never });

      const first = service.connect(creator, available);
      const second = service.connect(creator, available);

      await expect(first).rejects.toBeInstanceOf(LedgerError);
      await expect(second).rejects.toBeInstanceOf(LedgerError);

      const captureError = async (p: Promise<void>): Promise<LedgerError> => {
        try {
          await p;
          throw new Error('expected rejection');
        } catch (e) {
          return e as LedgerError;
        }
      };
      const firstError = await captureError(first);
      const secondError = await captureError(second);
      expect(firstError.ledgerEvent.status).toBe(secondError.ledgerEvent.status);
      expect(creator).toHaveBeenCalledTimes(2);
    });

    it('clears the latch after success so a later connect() runs a real attempt', async () => {
      const creator = jest.fn().mockResolvedValue(makeTransport());
      const available = jest.fn().mockResolvedValue(true);
      const service = new CasperLedgerService({ createLedgerApp: () => makeFakeApp() as never });

      await service.connect(creator, available);
      await service.connect(creator, available);

      expect(creator).toHaveBeenCalledTimes(2);
    });

    it('clears the latch after failure so a later connect() actually attempts again', async () => {
      const creator = jest
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce(makeTransport());
      const available = jest.fn().mockResolvedValue(true);
      const service = new CasperLedgerService({ createLedgerApp: () => makeFakeApp() as never });

      await expect(service.connect(creator, available)).rejects.toBeInstanceOf(LedgerError);
      await expect(service.connect(creator, available)).resolves.toBeUndefined();

      expect(creator).toHaveBeenCalledTimes(3);
    });

    it('does not latch an availability failure', async () => {
      const creator = jest.fn().mockResolvedValue(makeTransport());
      const available = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      const service = new CasperLedgerService({ createLedgerApp: () => makeFakeApp() as never });

      await expect(service.connect(creator, available)).rejects.toBeInstanceOf(LedgerError);
      await expect(service.connect(creator, available)).resolves.toBeUndefined();

      expect(creator).toHaveBeenCalledTimes(1);
    });

    it('rejects and clears the latch when the availability check itself throws', async () => {
      const creator = jest.fn().mockResolvedValue(makeTransport());
      const available = jest
        .fn()
        .mockRejectedValueOnce(new Error('permission revoked'))
        .mockResolvedValue(true);
      const service = new CasperLedgerService({ createLedgerApp: () => makeFakeApp() as never });

      await expect(service.connect(creator, available)).rejects.toMatchObject({
        message: expect.stringContaining(LedgerEventStatus.NotAvailable),
      });
      await expect(service.connect(creator, available)).resolves.toBeUndefined();

      expect(creator).toHaveBeenCalledTimes(1);
    });

    it('queues rather than shares a concurrent connect that asks for a different transport', async () => {
      const usbTransport = makeTransport();
      const btTransport = makeTransport();
      const usbCreator = jest.fn(async () => usbTransport);
      const btCreator = jest.fn(async () => btTransport);
      const available = jest.fn().mockResolvedValue(true);
      const service = new CasperLedgerService({ createLedgerApp: () => makeFakeApp() as never });

      const usbConnect = service.connect(usbCreator, available, false);
      const btConnect = service.connect(btCreator, available, true);

      await Promise.all([usbConnect, btConnect]);

      expect(usbCreator).toHaveBeenCalledTimes(1);
      expect(btCreator).toHaveBeenCalledTimes(1);
      expect(usbTransport.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('connected$', () => {
    beforeEach(() => {
      jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.useRealTimers();
    });

    const collectConnected = (service: CasperLedgerService) => {
      const seen: boolean[] = [];
      const sub = service.connected$.subscribe(v => seen.push(v));
      return { seen, stop: () => sub.unsubscribe() };
    };

    const connectedViaChannel = async () => {
      const state = new Subject<LedgerDeviceState>();
      const connected = await connectWithState(state);
      state.next(casperConnected);
      await flushMicrotasks();
      return { state, ...connected };
    };

    it('emits false when the channel reports the device locked', async () => {
      const { state, service } = await connectedViaChannel();
      const { seen, stop } = collectConnected(service);

      state.next({ status: 'locked' });
      await flushMicrotasks();
      stop();

      expect(seen).toEqual([true, false]);
      expect(service.isConnected).toBe(false);
    });

    it('emits true when the device comes back after a lock', async () => {
      const { state, service } = await connectedViaChannel();
      state.next({ status: 'locked' });
      await flushMicrotasks();
      const { seen, stop } = collectConnected(service);

      state.next(casperConnected);
      await flushMicrotasks();
      stop();

      expect(seen).toEqual([false, true]);
      expect(service.isConnected).toBe(true);
    });

    it('emits false when the transport fires its own disconnect event', async () => {
      const { service, transport } = await connectedViaChannel();
      const { seen, stop } = collectConnected(service);

      captureDisconnectHandler(transport)();
      await flushMicrotasks();
      stop();

      expect(seen).toEqual([true, false]);
    });

    it('emits false exactly once when disconnect() is called', async () => {
      const { service } = await connectService(makeFakeApp());
      const { seen, stop } = collectConnected(service);

      await service.disconnect();
      stop();

      expect(seen).toEqual([true, false]);
    });

    it('emits true when the status-word path reaches Connected', async () => {
      const service = new CasperLedgerService({ createLedgerApp: () => makeFakeApp() as never });
      const { seen, stop } = collectConnected(service);

      await service.connect(
        async () => makeTransport(),
        async () => true,
      );
      stop();

      expect(seen).toEqual([false, true]);
    });

    it('emits once, not twice, for two consecutive locked states', async () => {
      const { state, service } = await connectedViaChannel();
      const { seen, stop } = collectConnected(service);

      state.next({ status: 'locked' });
      state.next({ status: 'locked' });
      await flushMicrotasks();
      stop();

      expect(seen).toEqual([true, false]);
    });

    it('replays true to a subscriber that arrives after the service connected', async () => {
      const { service } = await connectService(makeFakeApp());
      const { seen, stop } = collectConnected(service);
      stop();

      expect(seen).toEqual([true]);
    });

    it('replays false to a subscriber on a service that never connected', () => {
      const service = new CasperLedgerService({ createLedgerApp: () => makeFakeApp() as never });
      const { seen, stop } = collectConnected(service);
      stop();

      expect(seen).toEqual([false]);
    });

    it('keeps isConnected equal to the last value it emitted', async () => {
      const state = new Subject<LedgerDeviceState>();
      const { service, transport } = await connectWithState(state);
      const seen: boolean[] = [];
      const sub = service.connected$.subscribe(v => {
        seen.push(v);
        expect(service.isConnected).toBe(v);
      });

      state.next(casperConnected);
      state.next({ status: 'locked' });
      state.next(casperConnected);
      await flushMicrotasks();
      captureDisconnectHandler(transport)();
      await flushMicrotasks();
      sub.unsubscribe();

      expect(seen).toEqual([false, true, false, true, false]);
      expect(service.isConnected).toBe(false);
    });

    it('leaves the ILedgerEvent sequence unchanged across a lock and a recovery', async () => {
      const state = new Subject<LedgerDeviceState>();
      const { service } = await connectWithState(state);
      const events: ILedgerEvent[] = [];
      const sub = service.ledgerEvents$.subscribe(e => events.push(e));

      state.next(casperConnected);
      state.next({ status: 'locked' });
      state.next(casperConnected);
      await flushMicrotasks();
      sub.unsubscribe();

      expect(events).toEqual([
        { status: LedgerEventStatus.Disconnected },
        { status: LedgerEventStatus.Connected },
        { status: LedgerEventStatus.DeviceLocked },
        { status: LedgerEventStatus.Connected },
      ]);
    });
  });
});
