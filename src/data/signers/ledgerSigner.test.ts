import { Transaction } from 'casper-js-sdk';
import { createLedgerSigner } from './ledgerSigner';
import { ICasperLedgerService, LedgerError, LedgerEventStatus } from '../../domain';

const publicKeyHex = '02abc';
const derivationIndex = 3;
const tx = { hash: 'tx' } as unknown as Transaction;
const fallbackDeploy = { hash: 'deploy' } as unknown as Parameters<
  typeof Transaction.fromDeploy
>[0];

const makeFakeService = (over: Record<string, unknown> = {}) => ({
  signTransaction: jest.fn().mockResolvedValue({
    signatureHex: '01',
    signature: new Uint8Array([1]),
    prefixedSignatureHex: '0201',
    prefixedSignature: new Uint8Array([2, 1]),
  }),
  getSignedTransaction: jest.fn().mockResolvedValue(tx),
  signMessage: jest.fn().mockResolvedValue({
    signatureHex: '07',
    signature: new Uint8Array([7]),
  }),
  ...over,
});

const makeSigner = (
  service: ReturnType<typeof makeFakeService>,
  over: Record<string, unknown> = {},
) =>
  createLedgerSigner({
    service: service as unknown as ICasperLedgerService,
    publicKeyHex,
    derivationIndex,
    ...over,
  });

describe('createLedgerSigner', () => {
  it('signTransaction delegates to service.signTransaction and maps prefixedSignature to signatureWithPrefix', async () => {
    const service = makeFakeService();
    const supportsTransactionV1Cb = jest.fn();
    const tryToRestoreSessionCb = jest.fn();
    const signer = makeSigner(service, { supportsTransactionV1Cb, tryToRestoreSessionCb });

    const resp = await signer.signTransaction(tx);

    expect(service.signTransaction).toHaveBeenCalledWith(
      tx,
      { index: derivationIndex, publicKey: publicKeyHex },
      supportsTransactionV1Cb,
      tryToRestoreSessionCb,
    );
    expect(resp).toEqual({
      signature: new Uint8Array([1]),
      signatureWithPrefix: new Uint8Array([2, 1]),
    });
  });

  it('signTransaction rethrows LedgerError untouched', async () => {
    const ledgerError = new LedgerError({ status: LedgerEventStatus.SignatureFailed });
    const service = makeFakeService({
      signTransaction: jest.fn().mockRejectedValue(ledgerError),
    });
    const signer = makeSigner(service);

    await expect(signer.signTransaction(tx)).rejects.toBe(ledgerError);
  });

  it('getSignedTransaction wraps a fallbackDeploy as a Transaction and forwards it', async () => {
    const service = makeFakeService();
    const supportsTransactionV1Cb = jest.fn();
    const tryToRestoreSessionCb = jest.fn();
    const signer = makeSigner(service, { supportsTransactionV1Cb, tryToRestoreSessionCb });
    const fromDeploySpy = jest.spyOn(Transaction, 'fromDeploy').mockReturnValue(tx);

    const result = await signer.getSignedTransaction(tx, { fallbackDeploy });

    expect(fromDeploySpy).toHaveBeenCalledWith(fallbackDeploy);
    expect(service.getSignedTransaction).toHaveBeenCalledWith(
      tx,
      { index: derivationIndex, publicKey: publicKeyHex },
      tx,
      supportsTransactionV1Cb,
      tryToRestoreSessionCb,
    );
    expect(result).toBe(tx);

    fromDeploySpy.mockRestore();
  });

  it('getSignedTransaction forwards undefined when there is no fallbackDeploy', async () => {
    const service = makeFakeService();
    const signer = makeSigner(service);

    await signer.getSignedTransaction(tx);

    expect(service.getSignedTransaction).toHaveBeenCalledWith(
      tx,
      { index: derivationIndex, publicKey: publicKeyHex },
      undefined,
      undefined,
      undefined,
    );
  });

  it('getSignedTransaction rethrows LedgerError untouched', async () => {
    const ledgerError = new LedgerError({ status: LedgerEventStatus.TransactionForOldAppVersion });
    const service = makeFakeService({
      getSignedTransaction: jest.fn().mockRejectedValue(ledgerError),
    });
    const signer = makeSigner(service);

    await expect(signer.getSignedTransaction(tx)).rejects.toBe(ledgerError);
  });

  it('signMessage delegates to service.signMessage and returns raw signature bytes', async () => {
    const service = makeFakeService();
    const tryToRestoreSessionCb = jest.fn();
    const signer = makeSigner(service, { tryToRestoreSessionCb });

    const signature = await signer.signMessage('hello');

    expect(service.signMessage).toHaveBeenCalledWith(
      'hello',
      { index: derivationIndex, publicKey: publicKeyHex },
      tryToRestoreSessionCb,
    );
    expect(signature).toEqual(new Uint8Array([7]));
  });

  it('signMessage rethrows LedgerError untouched', async () => {
    const ledgerError = new LedgerError({ status: LedgerEventStatus.MsgSignatureFailed });
    const service = makeFakeService({
      signMessage: jest.fn().mockRejectedValue(ledgerError),
    });
    const signer = makeSigner(service);

    await expect(signer.signMessage('hello')).rejects.toBe(ledgerError);
  });
});
