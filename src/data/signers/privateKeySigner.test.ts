import {
  Conversions,
  KeyAlgorithm,
  makeCsprTransferDeploy,
  PrivateKey,
  Transaction,
} from 'casper-js-sdk';
import { createPrivateKeySigner } from './privateKeySigner';
import { isTransactionSignedBy } from '../../utils/transactions';
import { EmptySignatureError } from '../../domain';

const TS = '2026-01-01T00:00:00.000Z';

const makeFixture = (alg: KeyAlgorithm) => {
  const pk = PrivateKey.generate(alg);
  const publicKeyHex = pk.publicKey.toHex();
  const secretKeyBase64 = Conversions.encodeBase64(pk.toBytes());
  const tx = Transaction.fromDeploy(
    makeCsprTransferDeploy({
      chainName: 'casper-test',
      recipientPublicKeyHex: PrivateKey.generate(KeyAlgorithm.ED25519).publicKey.toHex(),
      senderPublicKeyHex: publicKeyHex,
      transferAmount: '2500000000',
      timestamp: TS,
    }),
  );
  return { pk, publicKeyHex, secretKeyBase64, tx };
};

describe.each([KeyAlgorithm.ED25519, KeyAlgorithm.SECP256K1])('createPrivateKeySigner %p', alg => {
  it('signTransaction matches direct SDK signing byte-for-byte', async () => {
    const { pk, publicKeyHex, secretKeyBase64, tx } = makeFixture(alg);
    const signer = createPrivateKeySigner({ publicKeyHex, secretKeyBase64 });
    const resp = await signer.signTransaction(tx);
    expect(Buffer.from(resp.signature)).toEqual(Buffer.from(pk.sign(tx.hash.toBytes())));
    expect(Buffer.from(resp.signatureWithPrefix)).toEqual(
      Buffer.from(pk.signAndAddAlgorithmBytes(tx.hash.toBytes())),
    );
  });

  it('getSignedTransaction attaches a verifiable approval', async () => {
    const { publicKeyHex, secretKeyBase64, tx } = makeFixture(alg);
    const signer = createPrivateKeySigner({ publicKeyHex, secretKeyBase64 });
    const signed = await signer.getSignedTransaction(tx);
    expect(signed.approvals).toHaveLength(1);
    expect(isTransactionSignedBy(signed, publicKeyHex)).toBe(true);
    // case-insensitive, per isKeysEqual
    expect(isTransactionSignedBy(signed, publicKeyHex.toUpperCase())).toBe(true);
  });

  it('getSignedTransaction does not mark the transaction as signed by an unrelated key', async () => {
    const { publicKeyHex, secretKeyBase64, tx } = makeFixture(alg);
    const signer = createPrivateKeySigner({ publicKeyHex, secretKeyBase64 });
    const signed = await signer.getSignedTransaction(tx);
    const otherPublicKeyHex = PrivateKey.generate(KeyAlgorithm.ED25519).publicKey.toHex();
    expect(isTransactionSignedBy(signed, otherPublicKeyHex)).toBe(false);
  });

  it('signMessage signs raw header-prefixed bytes, unprefixed result', async () => {
    const { pk, publicKeyHex, secretKeyBase64 } = makeFixture(alg);
    const signer = createPrivateKeySigner({ publicKeyHex, secretKeyBase64 });
    const sig = await signer.signMessage('msg');
    expect(Buffer.from(sig)).toEqual(
      Buffer.from(pk.sign(Uint8Array.from(Buffer.from('Casper Message:\nmsg')))),
    );
  });
});

it('throws EmptySignatureError when the SDK returns a falsy signature', async () => {
  const { publicKeyHex, secretKeyBase64, tx } = makeFixture(KeyAlgorithm.ED25519);
  const signer = createPrivateKeySigner({ publicKeyHex, secretKeyBase64 });
  jest.spyOn(PrivateKey.prototype, 'sign').mockReturnValueOnce(undefined as never);
  await expect(signer.signTransaction(tx)).rejects.toThrow(EmptySignatureError);
});
