import {
  Conversions,
  KeyAlgorithm,
  makeCsprTransferDeploy,
  PrivateKey,
  Transaction,
} from 'casper-js-sdk';
import {
  AuctionManagerEntryPointType,
  CasperTransactionsError,
  CSPR_COIN,
  GrpcUrl,
  IBuiltDexTransaction,
  ICasperLedgerService,
  ICasperSigner,
  INft,
  IToken,
  LedgerError,
  LedgerEventStatus,
} from '../../../domain';
import { createLedgerSigner, createPrivateKeySigner } from '../../signers';
import * as txBuildersModule from '../../../utils/casperSdk/tx-builders';
import { CasperTransactionsRepository } from './index';

const mockGetStatus = jest.fn();
const mockPutTransaction = jest.fn();
const mockPutDeploy = jest.fn();
const mockSetReferrer = jest.fn();
const mockSetCustomHeaders = jest.fn();
const mockHttpHandlerCtor = jest.fn();

jest.mock('casper-js-sdk', () => ({
  ...jest.requireActual('casper-js-sdk'),
  HttpHandler: class {
    constructor(...args: unknown[]) {
      mockHttpHandlerCtor(...args);
    }
    setReferrer = mockSetReferrer;
    setCustomHeaders = mockSetCustomHeaders;
  },
  RpcClient: class {
    getStatus = mockGetStatus;
    putTransaction = mockPutTransaction;
    putDeploy = mockPutDeploy;
  },
}));

const nodeStatus = (isoDate: string, apiVersion = '2.0.0') => ({
  apiVersion,
  lastProgress: { toDate: () => new Date(isoDate) },
});

const sender = PrivateKey.generate(KeyAlgorithm.ED25519).publicKey.toHex();
const recipient = PrivateKey.generate(KeyAlgorithm.SECP256K1).publicKey.toHex();
const newValidator = PrivateKey.generate(KeyAlgorithm.ED25519).publicKey.toHex();

const generateKeysFixture = () => {
  const pk = PrivateKey.generate(KeyAlgorithm.ED25519);
  return {
    publicKeyHex: pk.publicKey.toHex(),
    secretKeyBase64: Conversions.encodeBase64(pk.toBytes()),
  };
};

const deployFixture = () =>
  makeCsprTransferDeploy({
    chainName: 'casper-test',
    senderPublicKeyHex: sender,
    recipientPublicKeyHex: recipient,
    transferAmount: '2500000000',
    timestamp: '2026-01-01T00:00:00.000Z',
  });

const txFixture = () => Transaction.fromDeploy(deployFixture());

const makeFakeSigner = (publicKeyHex: string) => {
  const calls: { fallbackDeploy?: unknown }[] = [];
  const signer: ICasperSigner = {
    publicKeyHex,
    signTransaction: jest.fn(async () => ({
      signature: new Uint8Array([1]),
      signatureWithPrefix: new Uint8Array([2, 1]),
    })),
    getSignedTransaction: jest.fn(async (tx, options) => {
      calls.push({ fallbackDeploy: options?.fallbackDeploy });
      return tx;
    }),
    signMessage: jest.fn(async () => new Uint8Array([7])),
  };
  return { signer, calls };
};

const CONTRACT_PACKAGE_HASH = 'b2ec4f982efa8643c979cb3ab42ad1a18851c2e6f91804cd3e65c079679bdc59';

const cep18Token: IToken = {
  ...CSPR_COIN,
  id: 'cep18-token',
  contractPackageHash: CONTRACT_PACKAGE_HASH,
  contractHash: CONTRACT_PACKAGE_HASH,
  decimals: 6,
  symbol: 'CEP18',
  isNative: false,
};

const nftFixture = (tokenIdType: INft['tokenIdType']): INft => ({
  id: 'nft-1',
  tokenId: '7',
  tokenIdType,
  trackingId: 'track-1',
  standard: 'CEP78',
  contractPackageHash: CONTRACT_PACKAGE_HASH,
  contractPackageIcon: null,
  contactName: 'Test NFT Contract',
  ownerReverseLookupMode: false,
  metadata: {},
  previewUrl: null,
  proxyPreviewUrl: null,
  timestamp: '2026-01-01T00:00:00.000Z',
});

describe('CasperTransactionsRepository rpc plumbing', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses node time when the node is ahead of local-2s', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:10.000Z'));
    mockGetStatus.mockResolvedValue(nodeStatus('2026-01-01T00:00:09.000Z'));
    const repo = new CasperTransactionsRepository(GrpcUrl);
    await expect(repo.getDateForTransaction('mainnet')).resolves.toBe('2026-01-01T00:00:09.000Z');
    jest.useRealTimers();
  });

  it('falls back to local-2s when the node lags or errors', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:10.000Z'));
    mockGetStatus.mockResolvedValue(nodeStatus('2026-01-01T00:00:01.000Z'));
    const repo = new CasperTransactionsRepository(GrpcUrl);
    await expect(repo.getDateForTransaction('mainnet')).resolves.toBe('2026-01-01T00:00:08.000Z');
    mockGetStatus.mockRejectedValue(new Error('down'));
    await expect(repo.getDateForTransaction('mainnet')).resolves.toBe('2026-01-01T00:00:08.000Z');
    jest.useRealTimers();
  });

  it('logs the node-time read that sent it back to the device clock', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:10.000Z'));
    const log = {
      log: jest.fn(),
      logGroup: jest.fn(),
      logGroupEnd: jest.fn(),
      reportError: jest.fn(),
    };
    mockGetStatus.mockRejectedValue(new Error('down'));
    const repo = new CasperTransactionsRepository(GrpcUrl, {}, log);

    await expect(repo.getDateForTransaction('mainnet')).resolves.toBe('2026-01-01T00:00:08.000Z');

    expect(log.reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.stringContaining('getDateForTransaction'),
    );
    jest.useRealTimers();
  });

  it('getNetworkApiVersion returns apiVersion and wraps RPC failures', async () => {
    mockGetStatus.mockResolvedValue(nodeStatus('2026-01-01T00:00:00.000Z', '1.5.8'));
    const repo = new CasperTransactionsRepository(GrpcUrl);
    await expect(repo.getNetworkApiVersion('testnet')).resolves.toBe('1.5.8');

    mockGetStatus.mockRejectedValue(new Error('down'));
    await expect(repo.getNetworkApiVersion('testnet')).rejects.toMatchObject({
      name: 'CasperTransactionsError',
      type: 'getNetworkApiVersion',
    });
  });

  it("default rpc options: 'fetch' handler + setReferrer, no Referer header", async () => {
    mockGetStatus.mockResolvedValue(nodeStatus('2026-01-01T00:00:00.000Z'));
    await new CasperTransactionsRepository(GrpcUrl).getNetworkApiVersion('mainnet');
    expect(mockHttpHandlerCtor).toHaveBeenCalledWith(GrpcUrl.mainnet, 'fetch');
    expect(mockSetReferrer).toHaveBeenCalledWith('https://casperwallet.io');
    expect(mockSetCustomHeaders).not.toHaveBeenCalled();
  });

  it("mobile rpc options: 'axios' handler + literal Referer header (+auth)", async () => {
    mockGetStatus.mockResolvedValue(nodeStatus('2026-01-01T00:00:00.000Z'));
    const repo = new CasperTransactionsRepository(GrpcUrl, {
      handlerType: 'axios',
      referrerMode: 'referer-header',
      authorizationHeader: 'token',
    });
    await repo.getNetworkApiVersion('mainnet');
    expect(mockHttpHandlerCtor).toHaveBeenCalledWith(GrpcUrl.mainnet, 'axios');
    expect(mockSetCustomHeaders).toHaveBeenCalledWith({
      Referer: 'https://casperwallet.io',
      Authorization: 'token',
    });
    expect(mockSetReferrer).not.toHaveBeenCalled();
  });
});

describe('sendSignedTransaction', () => {
  beforeEach(() => jest.clearAllMocks());

  it('2.x uses putTransaction and returns the tx hash', async () => {
    mockPutTransaction.mockResolvedValue({ transactionHash: { toHex: () => 'aabb' } });
    const repo = new CasperTransactionsRepository(GrpcUrl);
    const tx = txFixture();
    await expect(
      repo.sendSignedTransaction({
        transaction: tx,
        network: 'mainnet',
        casperNetworkApiVersion: '2.0.0',
      }),
    ).resolves.toBe('aabb');
    expect(mockPutDeploy).not.toHaveBeenCalled();
  });

  it('2.x: InvalidDeployError when putTransaction returns falsy', async () => {
    mockPutTransaction.mockResolvedValue(null);
    const repo = new CasperTransactionsRepository(GrpcUrl);
    await expect(
      repo.sendSignedTransaction({
        transaction: txFixture(),
        network: 'mainnet',
        casperNetworkApiVersion: '2.0.0',
      }),
    ).rejects.toThrow('errors:deploy-rpc-error');
  });

  it('1.x uses putDeploy; InvalidDeployError when RPC returns falsy or tx has no deploy', async () => {
    mockPutDeploy.mockResolvedValue({ deployHash: { toHex: () => 'ccdd' } });
    const repo = new CasperTransactionsRepository(GrpcUrl);
    await expect(
      repo.sendSignedTransaction({
        transaction: txFixture(),
        network: 'mainnet',
        casperNetworkApiVersion: '1.5.8',
      }),
    ).resolves.toBe('ccdd');

    mockPutDeploy.mockResolvedValue(null);
    await expect(
      repo.sendSignedTransaction({
        transaction: txFixture(),
        network: 'mainnet',
        casperNetworkApiVersion: '1.5.8',
      }),
    ).rejects.toThrow('errors:deploy-rpc-error');
  });

  it('1.x: InvalidDeployError when the transaction has no deploy to submit', async () => {
    const { transaction: v1Tx } = txBuildersModule.buildCsprTransferTransactions(
      {
        network: 'mainnet',
        senderPublicKeyHex: sender,
        recipientPublicKeyHex: recipient,
        transferAmountMotes: '2500000000',
        timestamp: '2026-01-01T00:00:00.000Z',
      },
      '2.0.0',
    );
    expect(v1Tx.getDeploy()).toBeFalsy();

    const repo = new CasperTransactionsRepository(GrpcUrl);
    await expect(
      repo.sendSignedTransaction({
        transaction: v1Tx,
        network: 'mainnet',
        casperNetworkApiVersion: '1.5.8',
      }),
    ).rejects.toThrow('errors:deploy-rpc-error');
    expect(mockPutDeploy).not.toHaveBeenCalled();
  });

  it('carries the node error through sendSignedTransaction', async () => {
    const nodeError = Object.assign(new Error('Code: 500, err: deploy error'), {
      statusCode: 500,
      sourceErr: Object.assign(new Error('invalid deploy'), { code: -32008, data: 'bad hash' }),
    });
    mockPutTransaction.mockRejectedValue(nodeError);
    const repo = new CasperTransactionsRepository(GrpcUrl);

    await expect(
      repo.sendSignedTransaction({
        transaction: txFixture(),
        network: 'mainnet',
        casperNetworkApiVersion: '2.0.0',
      }),
    ).rejects.toMatchObject({
      name: 'CasperTransactionsError',
      sourceError: nodeError,
    });
  });
});

describe('signTransaction / signMessage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects with AlreadySignedError before invoking the signer when the key already approved', async () => {
    const keys = generateKeysFixture();
    const signed = await createPrivateKeySigner(keys).getSignedTransaction(txFixture());
    const { signer } = makeFakeSigner(keys.publicKeyHex.toUpperCase());
    const repo = new CasperTransactionsRepository(GrpcUrl);
    await expect(repo.signTransaction({ transaction: signed, signer })).rejects.toThrow(
      'errors:already-signed',
    );
    expect(signer.signTransaction).not.toHaveBeenCalled();
  });

  it('returns the signer pair for a fresh transaction; signMessage delegates raw bytes', async () => {
    const { signer } = makeFakeSigner(sender);
    const repo = new CasperTransactionsRepository(GrpcUrl);
    await expect(repo.signTransaction({ transaction: txFixture(), signer })).resolves.toEqual({
      signature: new Uint8Array([1]),
      signatureWithPrefix: new Uint8Array([2, 1]),
    });
    await expect(repo.signMessage({ message: 'm', signer })).resolves.toEqual(new Uint8Array([7]));
  });
});

describe('composed sends', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sendTokenTransfer (native) converts decimals, passes fallback deploy to the signer', async () => {
    mockGetStatus.mockResolvedValue(nodeStatus('2026-01-01T00:00:00.000Z'));
    mockPutTransaction.mockResolvedValue({ transactionHash: { toHex: () => 'ee' } });
    // The SDK CLValue-encodes the transfer amount as bytes, so the motes value is asserted
    // through the builder spy rather than the serialized transaction.
    const buildSpy = jest.spyOn(txBuildersModule, 'buildCsprTransferTransactions');
    const { signer, calls } = makeFakeSigner(sender);
    const repo = new CasperTransactionsRepository(GrpcUrl);
    await expect(
      repo.sendTokenTransfer({
        token: { ...CSPR_COIN },
        network: 'testnet',
        casperNetworkApiVersion: '2.0.0',
        toPublicKeyHex: recipient,
        amount: '2.5',
        paymentAmount: '0.1',
        memo: '42',
        signer,
      }),
    ).resolves.toBe('ee');
    expect(calls[0].fallbackDeploy).toBeTruthy(); // fallback always provided
    expect(buildSpy).toHaveBeenCalledWith(
      expect.objectContaining({ transferAmountMotes: '2500000000', memo: '42' }),
      '2.0.0',
    );
  });

  it('sendTokenTransfer (CEP-18) converts amount with token.decimals and payment with CSPR decimals', async () => {
    mockGetStatus.mockResolvedValue(nodeStatus('2026-01-01T00:00:00.000Z'));
    mockPutTransaction.mockResolvedValue({ transactionHash: { toHex: () => 'cep18' } });
    const buildSpy = jest.spyOn(txBuildersModule, 'buildCep18TransferTransactions');
    const { signer } = makeFakeSigner(sender);
    const repo = new CasperTransactionsRepository(GrpcUrl);
    await expect(
      repo.sendTokenTransfer({
        token: cep18Token,
        network: 'testnet',
        casperNetworkApiVersion: '2.0.0',
        toPublicKeyHex: recipient,
        amount: '1.5',
        paymentAmount: '2.5',
        signer,
      }),
    ).resolves.toBe('cep18');
    expect(buildSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        contractPackageHash: cep18Token.contractPackageHash,
        transferAmountMotes: '1500000',
        paymentAmountMotes: '2500000000',
      }),
      '2.0.0',
    );
  });

  describe('sendNftTransfer', () => {
    it('uint tokenIdType sets tokenId, leaves tokenHash unset', async () => {
      mockGetStatus.mockResolvedValue(nodeStatus('2026-01-01T00:00:00.000Z'));
      mockPutTransaction.mockResolvedValue({ transactionHash: { toHex: () => 'nft-uint' } });
      const buildSpy = jest.spyOn(txBuildersModule, 'buildNftTransferTransactions');
      const { signer } = makeFakeSigner(sender);
      const repo = new CasperTransactionsRepository(GrpcUrl);
      await expect(
        repo.sendNftTransfer({
          nft: nftFixture('uint'),
          network: 'testnet',
          casperNetworkApiVersion: '2.0.0',
          toPublicKeyHex: recipient,
          paymentAmount: '0.1',
          signer,
        }),
      ).resolves.toBe('nft-uint');
      expect(buildSpy).toHaveBeenCalledWith(
        expect.objectContaining({ tokenId: '7', tokenHash: undefined }),
        '2.0.0',
      );
    });

    it('hash tokenIdType sets tokenHash, leaves tokenId unset', async () => {
      mockGetStatus.mockResolvedValue(nodeStatus('2026-01-01T00:00:00.000Z'));
      mockPutTransaction.mockResolvedValue({ transactionHash: { toHex: () => 'nft-hash' } });
      const buildSpy = jest.spyOn(txBuildersModule, 'buildNftTransferTransactions');
      const { signer } = makeFakeSigner(sender);
      const repo = new CasperTransactionsRepository(GrpcUrl);
      await expect(
        repo.sendNftTransfer({
          nft: nftFixture('hash'),
          network: 'testnet',
          casperNetworkApiVersion: '2.0.0',
          toPublicKeyHex: recipient,
          paymentAmount: '0.1',
          signer,
        }),
      ).resolves.toBe('nft-hash');
      expect(buildSpy).toHaveBeenCalledWith(
        expect.objectContaining({ tokenId: undefined, tokenHash: '7' }),
        '2.0.0',
      );
    });
  });

  describe('sendDelegation', () => {
    it.each<AuctionManagerEntryPointType>(['DELEGATE', 'UNDELEGATE', 'REDELEGATE'])(
      'builds via the auction manager builder and converts stake/payment with CSPR decimals — %s',
      async entryPoint => {
        mockGetStatus.mockResolvedValue(nodeStatus('2026-01-01T00:00:00.000Z'));
        mockPutTransaction.mockResolvedValue({
          transactionHash: { toHex: () => `hash-${entryPoint}` },
        });
        const buildSpy = jest.spyOn(txBuildersModule, 'buildAuctionManagerTransactions');
        const { signer } = makeFakeSigner(sender);
        const repo = new CasperTransactionsRepository(GrpcUrl);
        await expect(
          repo.sendDelegation({
            network: 'testnet',
            casperNetworkApiVersion: '2.0.0',
            entryPoint,
            stake: '10',
            paymentAmount: '2.5',
            validatorPublicKeyHex: recipient,
            newValidatorPublicKeyHex: entryPoint === 'REDELEGATE' ? newValidator : undefined,
            signer,
          }),
        ).resolves.toBe(`hash-${entryPoint}`);
        expect(buildSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            entryPoint,
            delegatorPublicKeyHex: sender,
            amountMotes: '10000000000',
            paymentAmountMotes: '2500000000',
          }),
          '2.0.0',
        );
      },
    );
  });

  it('feeds getDateForTransaction result into the builder', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:10.000Z'));
    mockGetStatus.mockResolvedValue(nodeStatus('2026-01-01T00:00:09.000Z'));
    mockPutTransaction.mockResolvedValue({ transactionHash: { toHex: () => 'ts' } });
    const buildSpy = jest.spyOn(txBuildersModule, 'buildCsprTransferTransactions');
    const { signer } = makeFakeSigner(sender);
    const repo = new CasperTransactionsRepository(GrpcUrl);
    await repo.sendTokenTransfer({
      token: { ...CSPR_COIN },
      network: 'testnet',
      casperNetworkApiVersion: '2.0.0',
      toPublicKeyHex: recipient,
      amount: '1',
      paymentAmount: '0.1',
      signer,
    });
    expect(buildSpy).toHaveBeenCalledWith(
      expect.objectContaining({ timestamp: '2026-01-01T00:00:09.000Z' }),
      '2.0.0',
    );
    jest.useRealTimers();
  });

  describe('error wrapping', () => {
    it('wraps a plain error thrown inside sendTokenTransfer as CasperTransactionsError', async () => {
      mockGetStatus.mockResolvedValue(nodeStatus('2026-01-01T00:00:00.000Z'));
      const { signer } = makeFakeSigner(sender);
      (signer.getSignedTransaction as jest.Mock).mockRejectedValueOnce(new Error('signer offline'));
      const repo = new CasperTransactionsRepository(GrpcUrl);
      await expect(
        repo.sendTokenTransfer({
          token: { ...CSPR_COIN },
          network: 'testnet',
          casperNetworkApiVersion: '2.0.0',
          toPublicKeyHex: recipient,
          amount: '1',
          paymentAmount: '0.1',
          signer,
        }),
      ).rejects.toMatchObject({
        name: 'CasperTransactionsError',
        type: 'sendTokenTransfer',
        message: 'signer offline',
      });
    });

    it('rethrows a nested CasperTransactionsError untouched (not relabeled)', async () => {
      mockGetStatus.mockResolvedValue(nodeStatus('2026-01-01T00:00:00.000Z'));
      const { signer } = makeFakeSigner(sender);
      (signer.getSignedTransaction as jest.Mock).mockRejectedValueOnce(
        new CasperTransactionsError(new Error('unrelated failure'), 'signMessage'),
      );
      const repo = new CasperTransactionsRepository(GrpcUrl);
      await expect(
        repo.sendTokenTransfer({
          token: { ...CSPR_COIN },
          network: 'testnet',
          casperNetworkApiVersion: '2.0.0',
          toPublicKeyHex: recipient,
          amount: '1',
          paymentAmount: '0.1',
          signer,
        }),
      ).rejects.toMatchObject({ name: 'CasperTransactionsError', type: 'signMessage' });
    });

    it('rethrows InvalidDeployError from a nested submit untouched (not relabeled)', async () => {
      mockGetStatus.mockResolvedValue(nodeStatus('2026-01-01T00:00:00.000Z'));
      mockPutTransaction.mockResolvedValue(null);
      const { signer } = makeFakeSigner(sender);
      const repo = new CasperTransactionsRepository(GrpcUrl);
      await expect(
        repo.sendTokenTransfer({
          token: { ...CSPR_COIN },
          network: 'testnet',
          casperNetworkApiVersion: '2.0.0',
          toPublicKeyHex: recipient,
          amount: '1',
          paymentAmount: '0.1',
          signer,
        }),
      ).rejects.toMatchObject({ name: 'DeploysRepositoryError', type: 'invalidDeploy' });
    });

    it('rethrows a LedgerError from a nested signer untouched (not wrapped)', async () => {
      mockGetStatus.mockResolvedValue(nodeStatus('2026-01-01T00:00:00.000Z'));
      const { signer } = makeFakeSigner(sender);
      const ledgerError = new LedgerError({ status: LedgerEventStatus.SignatureCanceled });
      (signer.getSignedTransaction as jest.Mock).mockRejectedValueOnce(ledgerError);
      const repo = new CasperTransactionsRepository(GrpcUrl);
      await expect(
        repo.sendTokenTransfer({
          token: { ...CSPR_COIN },
          network: 'testnet',
          casperNetworkApiVersion: '2.0.0',
          toPublicKeyHex: recipient,
          amount: '1',
          paymentAmount: '0.1',
          signer,
        }),
      ).rejects.toBe(ledgerError);
    });
  });
});

const makeOldAppLedgerService = () => ({
  getSignedTransaction: jest.fn(
    async (
      tx: Transaction,
      _account: unknown,
      fallbackTxFromDeploy?: Transaction,
    ): Promise<Transaction> => {
      if (!fallbackTxFromDeploy) {
        throw new LedgerError({ status: LedgerEventStatus.TransactionForOldAppVersion });
      }

      return fallbackTxFromDeploy;
    },
  ),
});

describe('sendDexTransaction', () => {
  beforeEach(() => jest.clearAllMocks());

  const dexBuilt = (over: Partial<IBuiltDexTransaction>): IBuiltDexTransaction =>
    ({
      kind: 'swap',
      entryPoint: 'swap_exact_cspr_for_tokens',
      paymentMotes: '15000000000',
      ...over,
    }) as IBuiltDexTransaction;

  it('signs and submits a V1 artifact via putTransaction, no fallback option', async () => {
    mockPutTransaction.mockResolvedValue({ transactionHash: { toHex: () => 'a1' } });
    const { signer } = makeFakeSigner(sender);
    const repo = new CasperTransactionsRepository(GrpcUrl);
    await expect(
      repo.sendDexTransaction({
        built: dexBuilt({ transaction: txFixture() }),
        network: 'mainnet',
        signer,
      }),
    ).resolves.toBe('a1');
    expect(mockPutDeploy).not.toHaveBeenCalled();
    expect((signer.getSignedTransaction as jest.Mock).mock.calls[0][1]).toBeUndefined();
  });

  it('wraps, signs and submits a deploy artifact via putDeploy', async () => {
    mockPutDeploy.mockResolvedValue({ deployHash: { toHex: () => 'b2' } });
    const { signer } = makeFakeSigner(sender);
    const repo = new CasperTransactionsRepository(GrpcUrl);
    const deploy = deployFixture();
    await expect(
      repo.sendDexTransaction({ built: dexBuilt({ deploy }), network: 'mainnet', signer }),
    ).resolves.toBe('b2');
    expect(mockPutTransaction).not.toHaveBeenCalled();
    expect((signer.getSignedTransaction as jest.Mock).mock.calls[0][1]).toEqual({
      fallbackDeploy: deploy,
    });
  });

  it('a Ledger on a pre-v3 app signs the deploy artifact instead of being told to update', async () => {
    mockPutDeploy.mockResolvedValue({ deployHash: { toHex: () => 'c3' } });
    const deploy = deployFixture();
    const ledgerService = makeOldAppLedgerService();
    const signer = createLedgerSigner({
      service: ledgerService as unknown as ICasperLedgerService,
      publicKeyHex: sender,
    });
    const repo = new CasperTransactionsRepository(GrpcUrl);

    await expect(
      repo.sendDexTransaction({ built: dexBuilt({ deploy }), network: 'mainnet', signer }),
    ).resolves.toBe('c3');
  });

  it('V1 artifact: InvalidDeployError (not wrapped) when putTransaction resolves falsy', async () => {
    mockPutTransaction.mockResolvedValue(null);
    const { signer } = makeFakeSigner(sender);
    const repo = new CasperTransactionsRepository(GrpcUrl);
    await expect(
      repo.sendDexTransaction({
        built: dexBuilt({ transaction: txFixture() }),
        network: 'mainnet',
        signer,
      }),
    ).rejects.toMatchObject({ name: 'DeploysRepositoryError', message: 'errors:deploy-rpc-error' });
  });

  it('deploy artifact: InvalidDeployError (not wrapped) when putDeploy resolves falsy', async () => {
    mockPutDeploy.mockResolvedValue(null);
    const { signer } = makeFakeSigner(sender);
    const repo = new CasperTransactionsRepository(GrpcUrl);
    const deploy = deployFixture();
    await expect(
      repo.sendDexTransaction({ built: dexBuilt({ deploy }), network: 'mainnet', signer }),
    ).rejects.toMatchObject({ name: 'DeploysRepositoryError', message: 'errors:deploy-rpc-error' });
  });

  it('rejects a malformed artifact and wraps plain errors with its own type', async () => {
    const { signer } = makeFakeSigner(sender);
    const repo = new CasperTransactionsRepository(GrpcUrl);
    await expect(
      repo.sendDexTransaction({ built: dexBuilt({}), network: 'mainnet', signer }),
    ).rejects.toThrow('errors:deploy-rpc-error');

    (signer.getSignedTransaction as jest.Mock).mockRejectedValueOnce(new Error('nope'));
    await expect(
      repo.sendDexTransaction({
        built: dexBuilt({ transaction: txFixture() }),
        network: 'mainnet',
        signer,
      }),
    ).rejects.toMatchObject({ name: 'CasperTransactionsError', type: 'sendDexTransaction' });
  });
});
