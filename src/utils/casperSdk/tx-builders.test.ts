import {
  AuctionManagerEntryPoint,
  CasperNetworkName,
  Deploy,
  KeyAlgorithm,
  makeCsprTransferDeploy,
  PrivateKey,
} from 'casper-js-sdk';
import { CasperNetwork } from '../../domain/common';
import { CasperSdkNetworkName } from '../../domain/constants';
import * as casperSdkBarrel from './index';
import {
  AuctionManagerEntryPointMap,
  buildAuctionManagerTransactions,
  buildCep18TransferTransactions,
  buildCsprTransferTransactions,
  buildNftTransferTransactions,
} from './tx-builders';
import { makeNftTransferTransaction, NFTTokenStandard } from './cep-nft-transfer';

const TS = '2026-01-01T00:00:00.000Z';
const sender = PrivateKey.generate(KeyAlgorithm.SECP256K1).publicKey.toHex();
const recipient = PrivateKey.generate(KeyAlgorithm.ED25519).publicKey.toHex();
const PKG = 'b2ec4f982efa8643c979cb3ab42ad1a18851c2e6f91804cd3e65c079679bdc59';

describe('buildCsprTransferTransactions', () => {
  const params = {
    network: 'testnet' as const,
    senderPublicKeyHex: sender,
    recipientPublicKeyHex: recipient,
    transferAmountMotes: '2500000000',
    timestamp: TS,
  };

  it('2.x: native TransactionV1 + legacy fallback deploy', () => {
    const { transaction, fallbackDeploy } = buildCsprTransferTransactions(params, '2.0.0');
    expect(transaction.getDeploy()).toBeFalsy();
    expect(fallbackDeploy).toBeTruthy();
    expect(transaction.chainName).toBe('casper-test');
  });

  it('1.x: deploy-wrapped transaction, byte-equal to a direct SDK deploy build', () => {
    const { transaction } = buildCsprTransferTransactions(params, '1.5.8');
    const deploy = transaction.getDeploy();
    expect(deploy).toBeTruthy();

    const direct = makeCsprTransferDeploy({
      chainName: 'casper-test',
      senderPublicKeyHex: sender,
      recipientPublicKeyHex: recipient,
      transferAmount: '2500000000',
      timestamp: TS,
    });
    expect(JSON.stringify(Deploy.toJSON(deploy as Deploy))).toBe(
      JSON.stringify(Deploy.toJSON(direct)),
    );
  });

  it('memo passes through untouched and is not defaulted', () => {
    // The SDK carries `memo` as the transfer's numeric `id` CLValue (`Some`/`None` of U64), so
    // the assertion reads that arg rather than matching text.
    const withMemo = buildCsprTransferTransactions({ ...params, memo: '777' }, '1.5.8');
    const noMemo = buildCsprTransferTransactions(params, '1.5.8');
    const idArg = (name: [string, { bytes: string }][]) =>
      name.find(([argName]) => argName === 'id')?.[1].bytes;

    const withMemoArgs = (Deploy.toJSON(withMemo.fallbackDeploy) as any).session.Transfer.args;
    const noMemoArgs = (Deploy.toJSON(noMemo.fallbackDeploy) as any).session.Transfer.args;
    expect(idArg(withMemoArgs)).toBe('010903000000000000');
    expect(idArg(noMemoArgs)).toBe('00');

    // deterministic: two no-memo builds are identical (no Date.now injection)
    expect(JSON.stringify(Deploy.toJSON(noMemo.fallbackDeploy))).toBe(
      JSON.stringify(Deploy.toJSON(buildCsprTransferTransactions(params, '1.5.8').fallbackDeploy)),
    );
  });

  it('gasPrice defaults to 1 on both tx and fallback when omitted', () => {
    const { transaction, fallbackDeploy } = buildCsprTransferTransactions(params, '2.0.0');
    const txJson = transaction.toJSON() as unknown as Record<string, any>;
    expect(txJson.payload.pricing_mode.PaymentLimited.gas_price_tolerance).toBe(1);
    expect((Deploy.toJSON(fallbackDeploy) as any).header.gas_price).toBe(1);
  });

  it.each([
    ['mainnet', 'casper'],
    ['testnet', 'casper-test'],
    ['devnet', 'dev-net'],
    ['integration', 'integration-test'],
  ] satisfies [CasperNetwork, string][])(
    'maps network %s to chain name %s via CasperSdkNetworkName',
    (network, chainName) => {
      const { transaction } = buildCsprTransferTransactions({ ...params, network }, '2.0.0');
      expect(transaction.chainName).toBe(chainName);
    },
  );
});

describe('buildCep18TransferTransactions', () => {
  const params = {
    network: 'mainnet' as const,
    contractPackageHash: PKG,
    senderPublicKeyHex: sender,
    recipientPublicKeyHex: recipient,
    transferAmountMotes: '25000000000',
    paymentAmountMotes: '3000000000',
    timestamp: TS,
  };

  it('2.x: V1 tx targets the package hash; fallback deploy targets the same package with a transfer entry point', () => {
    const { transaction, fallbackDeploy } = buildCep18TransferTransactions(params, '2.0.0');
    expect(transaction.getDeploy()).toBeFalsy();

    const txJson = transaction.toJSON() as unknown as Record<string, any>;
    expect(txJson.payload.fields.target.Stored.id.ByPackageHash.addr).toBe(PKG);
    expect(txJson.payload.fields.entry_point).toEqual({ Custom: 'transfer' });

    const fallbackJson = Deploy.toJSON(fallbackDeploy) as any;
    expect(fallbackJson.session.StoredVersionedContractByHash.hash).toBe(PKG);
    expect(fallbackJson.session.StoredVersionedContractByHash.entry_point).toBe('transfer');
  });

  it('maps network to chain name via CasperSdkNetworkName', () => {
    const { transaction } = buildCep18TransferTransactions(
      { ...params, network: 'testnet' },
      '2.0.0',
    );
    expect(transaction.chainName).toBe(CasperSdkNetworkName.testnet);
  });
});

describe('buildAuctionManagerTransactions', () => {
  const params = {
    network: 'testnet' as const,
    delegatorPublicKeyHex: sender,
    validatorPublicKeyHex: recipient,
    amountMotes: '500000000000',
    paymentAmountMotes: '2500000000',
    timestamp: TS,
  };

  it.each([
    ['DELEGATE', 'Delegate', 'delegate'] as const,
    ['UNDELEGATE', 'Undelegate', 'undelegate'] as const,
  ])(
    '%s maps to the SDK entry point on both tx and fallback, without a new-validator arg',
    (entryPoint, txEntryPoint, fallbackEntryPoint) => {
      const { transaction, fallbackDeploy } = buildAuctionManagerTransactions(
        { ...params, entryPoint, newValidatorPublicKeyHex: recipient },
        '2.0.0',
      );

      const txJson = transaction.toJSON() as unknown as Record<string, any>;
      expect(txJson.payload.fields.entry_point).toBe(txEntryPoint);
      const txArgNames = txJson.payload.fields.args.Named.map(([name]: [string]) => name);
      expect(txArgNames).not.toContain('new_validator');

      const fallbackJson = Deploy.toJSON(fallbackDeploy) as any;
      expect(fallbackJson.session.StoredContractByHash.entry_point).toBe(fallbackEntryPoint);
    },
  );

  it('REDELEGATE passes newValidatorPublicKeyHex through to both tx and fallback', () => {
    const newValidator = PrivateKey.generate(KeyAlgorithm.ED25519).publicKey.toHex();
    const { transaction, fallbackDeploy } = buildAuctionManagerTransactions(
      { ...params, entryPoint: 'REDELEGATE', newValidatorPublicKeyHex: newValidator },
      '2.0.0',
    );

    const txJson = transaction.toJSON() as unknown as Record<string, any>;
    expect(txJson.payload.fields.entry_point).toBe('Redelegate');
    const txArgNames = txJson.payload.fields.args.Named.map(([name]: [string]) => name);
    expect(txArgNames).toContain('new_validator');

    const fallbackJson = Deploy.toJSON(fallbackDeploy) as any;
    expect(fallbackJson.session.StoredContractByHash.entry_point).toBe('redelegate');
    const fallbackArgNames = fallbackJson.session.StoredContractByHash.args.map(
      ([name]: [string]) => name,
    );
    expect(fallbackArgNames).toContain('new_validator');
  });

  it('gasPrice defaults to 1 when omitted', () => {
    const { transaction, fallbackDeploy } = buildAuctionManagerTransactions(
      { ...params, entryPoint: 'DELEGATE' },
      '2.0.0',
    );
    const txJson = transaction.toJSON() as unknown as Record<string, any>;
    expect(txJson.payload.pricing_mode.PaymentLimited.gas_price_tolerance).toBe(1);
    expect((Deploy.toJSON(fallbackDeploy) as any).header.gas_price).toBe(1);
  });
});

describe('buildNftTransferTransactions', () => {
  const params = {
    network: 'mainnet' as const,
    contractPackageHash: PKG,
    nftStandard: 'CEP78' as const,
    senderPublicKeyHex: sender,
    recipientPublicKeyHex: recipient,
    paymentAmountMotes: '15000000000',
    tokenId: '1',
    timestamp: TS,
  };

  it('fallback deploy is byte-equal to the legacy "1.5.8" hack (D11)', () => {
    const { fallbackDeploy } = buildNftTransferTransactions(params, '2.0.0');
    const legacy = makeNftTransferTransaction({
      chainName: 'casper',
      contractPackageHash: PKG,
      nftStandard: NFTTokenStandard.CEP78,
      paymentAmount: '15000000000',
      recipientPublicKeyHex: recipient,
      senderPublicKeyHex: sender,
      tokenId: '1',
      timestamp: TS,
      casperNetworkApiVersion: '1.5.8',
      gasPrice: 1,
    }).getDeploy();
    expect(JSON.stringify(Deploy.toJSON(fallbackDeploy))).toBe(
      JSON.stringify(Deploy.toJSON(legacy as Deploy)),
    );
  });

  it('CEP95, 2.x: V1 tx entry point transfer_from', () => {
    const { transaction } = buildNftTransferTransactions(
      { ...params, nftStandard: 'CEP95' },
      '2.0.0',
    );
    const json = transaction.toJSON() as unknown as Record<string, any>;
    expect(json.payload.fields.entry_point).toEqual({ Custom: 'transfer_from' });
  });

  it('tokenId sets is_hash_identifier_mode false and forwards token_id', () => {
    const { transaction } = buildNftTransferTransactions(params, '2.0.0');
    const args = (transaction.toJSON() as unknown as Record<string, any>).payload.fields.args.Named;
    const byName = Object.fromEntries(args);
    expect(byName.is_hash_identifier_mode.bytes).toBe('00');
    expect(byName.token_id).toBeDefined();
    expect(byName.token_hash).toBeUndefined();
  });

  it('tokenHash sets is_hash_identifier_mode true and forwards token_hash', () => {
    const { transaction } = buildNftTransferTransactions(
      { ...params, tokenId: undefined, tokenHash: 'deadbeef' },
      '2.0.0',
    );
    const args = (transaction.toJSON() as unknown as Record<string, any>).payload.fields.args.Named;
    const byName = Object.fromEntries(args);
    expect(byName.is_hash_identifier_mode.bytes).toBe('01');
    expect(byName.token_hash).toBeDefined();
    expect(byName.token_id).toBeUndefined();
  });

  it('throws when neither tokenId nor tokenHash is provided', () => {
    expect(() => buildNftTransferTransactions({ ...params, tokenId: undefined }, '2.0.0')).toThrow(
      /Specify either tokenId or tokenHash/,
    );
  });
});

describe('constants moved next to the SDK (D13)', () => {
  it('auction entry point map matches the SDK enum', () => {
    expect(AuctionManagerEntryPointMap).toEqual({
      DELEGATE: AuctionManagerEntryPoint.delegate,
      UNDELEGATE: AuctionManagerEntryPoint.undelegate,
      REDELEGATE: AuctionManagerEntryPoint.redelegate,
    });
  });

  it('CasperSdkNetworkName values equal the SDK CasperNetworkName values', () => {
    expect(CasperSdkNetworkName).toEqual({
      mainnet: CasperNetworkName.Mainnet,
      testnet: CasperNetworkName.Testnet,
      devnet: CasperNetworkName.DevNet,
      integration: CasperNetworkName.Integration,
    });
  });
});

describe('barrel discipline', () => {
  it('is not re-exported from the SDK-free casperSdk barrel', () => {
    expect(
      (casperSdkBarrel as Record<string, unknown>).buildCsprTransferTransactions,
    ).toBeUndefined();
  });
});
