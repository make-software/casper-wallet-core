import { blake2b } from '@noble/hashes/blake2';
import { KeyAlgorithm, PrivateKey, Transaction } from 'casper-js-sdk';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

import { CasperLedgerService } from './service';
import {
  ICasperLedgerServiceOptions,
  LedgerDeviceState,
  LedgerError,
  LedgerEventStatus,
} from '../../domain';

jest.mock('../../utils/common', () => ({
  delay: jest.fn().mockResolvedValue(undefined),
}));

const CONNECTION_POLL_INTERVAL = 3000;

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

/** Collects every raw BehaviorSubject.next() payload, bypassing the debounceTime(300) pipe. */
const spyOnEvents = () => {
  const events: Array<{ status: LedgerEventStatus; [key: string]: unknown }> = [];
  const spy = jest.spyOn(BehaviorSubject.prototype, 'next').mockImplementation(function (
    this: BehaviorSubject<unknown>,
    value: unknown,
  ) {
    events.push(value as { status: LedgerEventStatus });
    return Object.getPrototypeOf(BehaviorSubject.prototype).next.call(this, value);
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

    // An unrecognized returnCode keeps the status-word path from settling on its own, so
    // assertions below isolate the state channel's effect.
    const stuckAppInfo = { returnCode: 0x6f00, appName: 'Casper', appVersion: '3.0.5' };
    const casperConnected: LedgerDeviceState = {
      status: 'connected',
      app: { name: 'Casper', version: '3.0.5' },
    };

    const connectWithState = async (state: Subject<LedgerDeviceState>) => {
      const app = makeFakeApp({ getAppInfo: jest.fn(async () => stuckAppInfo) });
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
      const { service } = await connectWithState(state);
      const { events, restore } = spyOnEvents();

      state.next({ status: 'connected' });
      await flushMicrotasks();
      restore();

      expect(events.some(e => e.status === LedgerEventStatus.DeviceLocked)).toBe(false);
      expect(events.some(e => e.status === LedgerEventStatus.CasperAppNotLoaded)).toBe(false);
      expect(events.some(e => e.status === LedgerEventStatus.Connected)).toBe(false);
      expect(service.isConnected).toBe(false);
    });

    it('swallows an error on the state channel without throwing (row 6)', async () => {
      const state = new Subject<LedgerDeviceState>();
      const { service } = await connectWithState(state);

      expect(() => state.error(new Error('boom'))).not.toThrow();
      expect(service.isConnected).toBe(false);
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

      await service.connect(
        async () => makeTransport(firstState.asObservable()),
        async () => true,
      );
      await service.connect(
        async () => makeTransport(secondState.asObservable()),
        async () => true,
      );

      const { events, restore } = spyOnEvents();
      firstState.next({ status: 'locked' });
      await flushMicrotasks();
      restore();

      expect(events.some(e => e.status === LedgerEventStatus.DeviceLocked)).toBe(false);
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
  });
});
