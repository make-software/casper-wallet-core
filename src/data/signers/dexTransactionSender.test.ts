import { createDexTransactionSender } from './dexTransactionSender';
import type { IBuiltDexTransaction, ICasperSigner } from '../../domain';

const built = { kind: 'swap', entryPoint: 'x', paymentMotes: '1' } as IBuiltDexTransaction;
const signer = { publicKeyHex: 'abc' } as ICasperSigner;
const flush = () => new Promise(process.nextTick);

const makeSender = (over: Record<string, unknown> = {}) => {
  const sendDexTransaction = jest.fn().mockResolvedValue('hash1');
  const waitForTransaction = jest.fn().mockResolvedValue(undefined);
  const sender = createDexTransactionSender({
    signer,
    casperTransactionsRepository: { sendDexTransaction },
    network: 'mainnet',
    supportsTransactionV1: true,
    waitForTransaction,
    ...over,
  });
  return { sender, sendDexTransaction, waitForTransaction };
};

it('submits, fires onSent, resolves before settlement, then onProcessed', async () => {
  const { sender, sendDexTransaction, waitForTransaction } = makeSender();
  const callbacks = { onSent: jest.fn(), onProcessed: jest.fn() };
  await sender.send(built, callbacks);
  expect(sendDexTransaction).toHaveBeenCalledWith({ built, network: 'mainnet', signer });
  expect(callbacks.onSent).toHaveBeenCalledWith('hash1');
  await flush();
  expect(waitForTransaction).toHaveBeenCalledWith('hash1', 'mainnet');
  expect(callbacks.onProcessed).toHaveBeenCalled();
});

it('routes settlement failure to onError without throwing', async () => {
  const boom = new Error('reverted');
  const { sender } = makeSender({ waitForTransaction: jest.fn().mockRejectedValue(boom) });
  const callbacks = { onProcessed: jest.fn(), onError: jest.fn() };
  await sender.send(built, callbacks);
  await flush();
  expect(callbacks.onError).toHaveBeenCalledWith(boom);
  expect(callbacks.onProcessed).not.toHaveBeenCalled();
});

it('maps a classified rejection to onCancelled, everything else to onError', async () => {
  const rejection = new Error('user said no');
  const failingRepo = { sendDexTransaction: jest.fn().mockRejectedValue(rejection) };

  const cancelAware = makeSender({
    casperTransactionsRepository: failingRepo,
    isCancellationError: (e: unknown) => e === rejection,
  });
  const cancelCallbacks = { onCancelled: jest.fn(), onError: jest.fn(), onSent: jest.fn() };
  await cancelAware.sender.send(built, cancelCallbacks);
  expect(cancelCallbacks.onCancelled).toHaveBeenCalled();
  expect(cancelCallbacks.onError).not.toHaveBeenCalled();
  expect(cancelCallbacks.onSent).not.toHaveBeenCalled();

  const plain = makeSender({ casperTransactionsRepository: failingRepo });
  const errorCallbacks = { onCancelled: jest.fn(), onError: jest.fn() };
  await plain.sender.send(built, errorCallbacks);
  expect(errorCallbacks.onError).toHaveBeenCalledWith(rejection);
  expect(errorCallbacks.onCancelled).not.toHaveBeenCalled();
});

it('passes through supportsTransactionV1 and the signer public key', () => {
  const { sender } = makeSender({ supportsTransactionV1: false });
  expect(sender.supportsTransactionV1).toBe(false);
  expect(sender.publicKey).toBe('abc');
});
