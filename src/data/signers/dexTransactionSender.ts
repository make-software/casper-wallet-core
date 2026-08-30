import type {
  CasperNetwork,
  IBuiltDexTransaction,
  ICasperSigner,
  ICasperTransactionsRepository,
  IDexTransactionSender,
  ITransactionCallbacks,
} from '../../domain';

export interface ICreateDexTransactionSenderParams {
  signer: ICasperSigner;
  casperTransactionsRepository: Pick<ICasperTransactionsRepository, 'sendDexTransaction'>;
  network: CasperNetwork;
  /** `casperNetworkApiVersion.startsWith('2.')` && (software key ? true : persisted Ledger capability). */
  supportsTransactionV1: boolean;
  /** Resolves when the submitted hash settles on-chain, rejects with the failure; app-side monitoring. */
  waitForTransaction: (transactionHash: string, network: CasperNetwork) => Promise<void>;
  /** Classifies a signing rejection as user cancellation (e.g. Ledger SignatureCanceled). Default: never. */
  isCancellationError?: (error: unknown) => boolean;
}

export const createDexTransactionSender = ({
  signer,
  casperTransactionsRepository,
  network,
  supportsTransactionV1,
  waitForTransaction,
  isCancellationError,
}: ICreateDexTransactionSenderParams): IDexTransactionSender => ({
  publicKey: signer.publicKeyHex,
  supportsTransactionV1,

  async send(built: IBuiltDexTransaction, callbacks: ITransactionCallbacks): Promise<void> {
    let transactionHash: string;

    try {
      transactionHash = await casperTransactionsRepository.sendDexTransaction({
        built,
        network,
        signer,
      });
    } catch (error) {
      if (isCancellationError?.(error)) {
        callbacks.onCancelled?.();
      } else {
        callbacks.onError?.(error);
      }

      return;
    }

    callbacks.onSent?.(transactionHash);

    // Deliberately not awaited: `send` resolves after submission (the port's contract);
    // settlement flows through the callbacks.
    waitForTransaction(transactionHash, network)
      .then(() => callbacks.onProcessed?.())
      .catch(error => callbacks.onError?.(error));
  },
});
