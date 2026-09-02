import { Conversions, PrivateKey, PublicKey, Transaction } from 'casper-js-sdk';
import {
  EmptySignatureError,
  ICasperSigner,
  ISignTransactionOptions,
  ISignTransactionResponse,
  KeyPairMismatchError,
} from '../../domain';
import { isKeysEqual } from '../../utils/common';
import { convertBase64ToBytes } from '../../utils/crypto';
import { createCasperMessageBytes, getPrivateKeyHexFromSecretKey } from '../../utils/transactions';

export interface ICreatePrivateKeySignerParams {
  publicKeyHex: string;
  /** base64 of the raw secret-key bytes — the encoding both wallets store in their vaults. */
  secretKeyBase64: string;
}

export const createPrivateKeySigner = ({
  publicKeyHex,
  secretKeyBase64,
}: ICreatePrivateKeySignerParams): ICasperSigner => {
  let cachedPrivateKey: PrivateKey | undefined;

  /** Derived once. Throws {@link KeyPairMismatchError} if the pair does not match. */
  const getPrivateKey = (): PrivateKey => {
    if (cachedPrivateKey) {
      return cachedPrivateKey;
    }

    const publicKey = PublicKey.fromHex(publicKeyHex);

    const privateKey = PrivateKey.fromHex(
      getPrivateKeyHexFromSecretKey(
        Conversions.encodeBase16(convertBase64ToBytes(secretKeyBase64)),
      ),
      publicKey.cryptoAlg,
    );

    if (!isKeysEqual(privateKey.publicKey.toHex(), publicKeyHex)) {
      throw new KeyPairMismatchError();
    }

    cachedPrivateKey = privateKey;

    return privateKey;
  };

  const sign = (data: Uint8Array, withAlgorithmPrefix: boolean): Uint8Array => {
    const privateKey = getPrivateKey();
    const signature = withAlgorithmPrefix
      ? privateKey.signAndAddAlgorithmBytes(data)
      : privateKey.sign(data);

    if (!signature) {
      throw new EmptySignatureError();
    }

    return signature;
  };

  return {
    publicKeyHex,

    async signTransaction(tx: Transaction): Promise<ISignTransactionResponse> {
      return {
        signature: sign(tx.hash.toBytes(), false),
        signatureWithPrefix: sign(tx.hash.toBytes(), true),
      };
    },

    // `options.fallbackDeploy` is intentionally ignored: a software key can always sign TransactionV1.
    async getSignedTransaction(
      tx: Transaction,
      _options?: ISignTransactionOptions,
    ): Promise<Transaction> {
      tx.sign(getPrivateKey());

      return tx;
    },

    async signMessage(message: string): Promise<Uint8Array> {
      return sign(createCasperMessageBytes(message), false);
    },
  };
};
