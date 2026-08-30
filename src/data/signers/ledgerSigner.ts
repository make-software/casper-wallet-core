import { Transaction } from 'casper-js-sdk';
import { ICasperSigner, ISignTransactionOptions, ISignTransactionResponse } from '../../domain';
import type { CasperLedgerService } from '../ledger';

export interface ICreateLedgerSignerParams {
  service: CasperLedgerService;
  publicKeyHex: string;
  derivationIndex?: number;
  supportsTransactionV1Cb?: (publicKey: string, supports: boolean) => Promise<void>;
  tryToRestoreSessionCb?: () => Promise<void>;
}

export const createLedgerSigner = ({
  service,
  publicKeyHex,
  derivationIndex,
  supportsTransactionV1Cb,
  tryToRestoreSessionCb,
}: ICreateLedgerSignerParams): ICasperSigner => ({
  publicKeyHex,

  async signTransaction(tx: Transaction): Promise<ISignTransactionResponse> {
    const resp = await service.signTransaction(
      tx,
      { index: derivationIndex, publicKey: publicKeyHex },
      supportsTransactionV1Cb,
      tryToRestoreSessionCb,
    );

    return { signature: resp.signature, signatureWithPrefix: resp.prefixedSignature };
  },

  async getSignedTransaction(
    tx: Transaction,
    options?: ISignTransactionOptions,
  ): Promise<Transaction> {
    return service.getSignedTransaction(
      tx,
      { index: derivationIndex, publicKey: publicKeyHex },
      options?.fallbackDeploy ? Transaction.fromDeploy(options.fallbackDeploy) : undefined,
      supportsTransactionV1Cb,
      tryToRestoreSessionCb,
    );
  },

  async signMessage(message: string): Promise<Uint8Array> {
    const resp = await service.signMessage(
      message,
      { index: derivationIndex, publicKey: publicKeyHex },
      tryToRestoreSessionCb,
    );

    return resp.signature;
  },
});
