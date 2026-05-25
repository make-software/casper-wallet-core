#!/usr/bin/env node
/* global require, process, console, Buffer */
/**
 * Builds one representative `Transaction` per signature-request action variant and
 * dumps it as JSON to `src/__fixtures__/transactions/`. Patterns mirror the
 * playground at /Users/compote/Projects/casper-wallet-playground/src/utils.ts.
 *
 * Run with:  node scripts/generate-tx-fixtures.cjs
 *
 * The generated JSON is consumed by txSignatureRequest tests via
 * `Transaction.fromJSON(fixture)` — the same code path production uses.
 */
const fs = require('fs');
const path = require('path');
const sdk = require('casper-js-sdk');

const {
  Args,
  AuctionManagerEntryPoint,
  CasperNetworkName,
  CLTypeString,
  CLTypeUInt256,
  CLTypeUInt512,
  CLTypeUInt8,
  CLValue,
  CLValueMap,
  CLTypeMap,
  ContractCallBuilder,
  Conversions,
  Key,
  KeyAlgorithm,
  NativeDelegateBuilder,
  NativeRedelegateBuilder,
  NativeTransferBuilder,
  NativeUndelegateBuilder,
  PrivateKey,
  PublicKey,
  SessionBuilder,
  makeAuctionManagerDeploy,
  makeCep18TransferDeploy,
  makeCep18TransferTransaction,
  makeCsprTransferDeploy,
  Transaction,
} = sdk;

// Deterministic test key (committed; never used for real transactions).
// Hex of an ED25519 private key generated once for fixture stability.
const TEST_PRIVATE_KEY_HEX = 'a2dbb64fddbcd5928c8475e5f65fdcb0e1fb49305cc1c25f44740d4c800088ac';
const SIGNER = PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX, KeyAlgorithm.ED25519);
const SIGNING_KEY = SIGNER.publicKey.toHex();
const RECIPIENT = '020329169b6c9e632fbeca5677fcad1bb48b87cd80500202911b933c16fa1d107e2e';
const VALIDATOR_A = '0106ca7c39cd272dbf21a86eeb3b36b7c26e2e9b94af64292419f7862936bca2ca';
const VALIDATOR_B = '017d9aa0b86413d7ff9a9169182c53f0bacaa80d34c211adab007ed4876af17077';
const VALIDATOR_C = '01c8be540a643e6c9df283dd2d2d6be67748f69a3c7bb6cf34471c899b8e858c9a';
const NFT_PACKAGE_HASH = '6ca070c78d4eb468b4db4cbc5cadd815c35e15019a841c137372a88d7e247d1d';
const CEP18_PACKAGE_HASH = '7fd113f60890c8ea77daf90880852f544b618c62315bcfd2dd93304c389fa19d';
const CSPR_MARKET_PACKAGE_HASH = '154ff59b5f9feec42d3a418058d66badcb2121dc3ffb2e3cf92596bf5aafbc88';
const ASSOCIATED_KEYS_PACKAGE_HASH =
  'ff9c3c0c447d2e3a79c02e13d048c03f6fac8a911fdc04118cc754c84ef6259e';
const WASM_PROXY_PACKAGE_HASH = 'e6e783a9ae53d220e33a23ccb6f3717a0045efbd274f3c32507e4277ec5da62d';

const OUT_DIR = path.resolve(__dirname, '..', 'src', '__fixtures__', 'transactions');
fs.mkdirSync(OUT_DIR, { recursive: true });

const fixtures = {};

// Allow-listed fixture filenames. Every call to writeFixture() is keyed off this
// list so we never join an unconstrained string into the output path.
const FIXTURE_FILES = Object.freeze({
  'cspr-native-transfer': `${OUT_DIR}/cspr-native-transfer.json`,
  'auction-delegate': `${OUT_DIR}/auction-delegate.json`,
  'auction-undelegate': `${OUT_DIR}/auction-undelegate.json`,
  'auction-redelegate': `${OUT_DIR}/auction-redelegate.json`,
  'nft-burn': `${OUT_DIR}/nft-burn.json`,
  'cep18-transfer': `${OUT_DIR}/cep18-transfer.json`,
  'cspr-market-list': `${OUT_DIR}/cspr-market-list.json`,
  'associated-keys-set': `${OUT_DIR}/associated-keys-set.json`,
  'unknown-contract': `${OUT_DIR}/unknown-contract.json`,
  'wasm-session': `${OUT_DIR}/wasm-session.json`,
  'wasm-proxy': `${OUT_DIR}/wasm-proxy.json`,
  'legacy-cspr-transfer-deploy': `${OUT_DIR}/legacy-cspr-transfer-deploy.json`,
  'legacy-auction-delegate-deploy': `${OUT_DIR}/legacy-auction-delegate-deploy.json`,
  'legacy-cep18-transfer-deploy': `${OUT_DIR}/legacy-cep18-transfer-deploy.json`,
});
const INDEX_PATH = `${OUT_DIR}/index.json`;

const writeFixture = (name, tx) => {
  const outPath = FIXTURE_FILES[name];
  if (!outPath) {
    throw new Error(`Refusing to write fixture with unregistered name: ${JSON.stringify(name)}`);
  }
  // tx.toJSON() returns the object that production code feeds back into
  // Transaction.fromJSON() — exactly what arrives via the wallet's request path.
  const json = JSON.parse(JSON.stringify(tx));
  fixtures[name] = json;
  fs.writeFileSync(outPath, JSON.stringify(json, null, 2) + '\n');
  // Sanity: round-trip through fromJSON so the test can rely on it not throwing.
  try {
    Transaction.fromJSON(json);
  } catch (e) {
    console.error('%s: Transaction.fromJSON round-trip FAILED: %s', name, e.message);
    process.exitCode = 1;
  }
};

// --- v1 Transaction (TransactionV1) builders ----------------------------------

// CSPR_NATIVE — NativeTransfer
writeFixture(
  'cspr-native-transfer',
  new NativeTransferBuilder()
    .from(PublicKey.fromHex(SIGNING_KEY))
    .target(PublicKey.fromHex(RECIPIENT))
    .amount('25000000000')
    .id(1)
    .chainName(CasperNetworkName.Testnet)
    .payment(100_000_000)
    .build(),
);

// AUCTION — Native delegate / undelegate / redelegate
writeFixture(
  'auction-delegate',
  new NativeDelegateBuilder()
    .from(PublicKey.fromHex(SIGNING_KEY))
    .validator(PublicKey.fromHex(VALIDATOR_A))
    .amount('2500000000')
    .payment(1_000_000_000)
    .chainName(CasperNetworkName.Testnet)
    .build(),
);

writeFixture(
  'auction-undelegate',
  new NativeUndelegateBuilder()
    .from(PublicKey.fromHex(SIGNING_KEY))
    .validator(PublicKey.fromHex(VALIDATOR_A))
    .amount('2500000000')
    .payment(1_000_000_000)
    .chainName(CasperNetworkName.Testnet)
    .build(),
);

writeFixture(
  'auction-redelegate',
  new NativeRedelegateBuilder()
    .from(PublicKey.fromHex(SIGNING_KEY))
    .validator(PublicKey.fromHex(VALIDATOR_B))
    .newValidator(PublicKey.fromHex(VALIDATOR_C))
    .amount('2500000000')
    .payment(1_000_000_000)
    .chainName(CasperNetworkName.Testnet)
    .build(),
);

// NFT — ContractCall (burn)
writeFixture(
  'nft-burn',
  new ContractCallBuilder()
    .from(PublicKey.fromHex(SIGNING_KEY))
    .byPackageHash(NFT_PACKAGE_HASH)
    .entryPoint('burn')
    .runtimeArgs(
      Args.fromMap({
        owner: CLValue.newCLPublicKey(PublicKey.fromHex(RECIPIENT)),
        token_ids: CLValue.newCLList(CLTypeUInt256, [CLValue.newCLUInt256(101)]),
      }),
    )
    .payment(3_000_000_000)
    .chainName(CasperNetworkName.Testnet)
    .build(),
);

// CEP18 — uses the SDK's official helper so the args shape matches what the wallet expects.
writeFixture(
  'cep18-transfer',
  makeCep18TransferTransaction({
    chainName: CasperNetworkName.Testnet,
    contractPackageHash: CEP18_PACKAGE_HASH,
    senderPublicKeyHex: SIGNING_KEY,
    recipientPublicKeyHex: RECIPIENT,
    transferAmount: '100000000000000000',
    paymentAmount: '3000000000',
    casperNetworkApiVersion: '2.0',
  }),
);

// CSPR_MARKET — list_token (mirrors makeCasperMarketListBuilder)
{
  const tokensClValue = CLValue.newCLMap(CLTypeString, CLTypeUInt512);
  const tokensClMapValue = new CLValueMap(new CLTypeMap(CLTypeString, CLTypeUInt512));
  tokensClMapValue.append(CLValue.newCLString('123'), CLValue.newCLUInt512('567'));
  tokensClValue.map = tokensClMapValue;

  writeFixture(
    'cspr-market-list',
    new ContractCallBuilder()
      .from(PublicKey.fromHex(SIGNING_KEY))
      .byPackageHash(CSPR_MARKET_PACKAGE_HASH)
      .entryPoint('list_token')
      .runtimeArgs(
        Args.fromMap({
          collection: CLValue.newCLKey(
            Key.newKey(`hash-998af6825d77da15485baf4bb89aeef3f1dfb4a78841d149574b0be694ce4821`),
          ),
          token_type: CLValue.newCLUint8(0),
          token_id_type: CLValue.newCLUint8(0),
          tokens: tokensClValue,
        }),
      )
      .payment(3_000_000_000)
      .chainName(CasperNetworkName.Testnet)
      .build(),
  );
}

// ASSOCIATED_KEYS — set_associated_keys
writeFixture(
  'associated-keys-set',
  new ContractCallBuilder()
    .from(PublicKey.fromHex(SIGNING_KEY))
    .byPackageHash(ASSOCIATED_KEYS_PACKAGE_HASH)
    .entryPoint('set_associated_keys')
    .runtimeArgs(Args.fromMap({}))
    .payment(3_000_000_000)
    .chainName(CasperNetworkName.Testnet)
    .build(),
);

// UNKNOWN — ContractCall pointing at a random package hash with arbitrary args
writeFixture(
  'unknown-contract',
  new ContractCallBuilder()
    .from(PublicKey.fromHex(SIGNING_KEY))
    .byPackageHash('0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20')
    .entryPoint('do_something')
    .runtimeArgs(
      Args.fromMap({
        flag: CLValue.newCLValueBool(true),
        note: CLValue.newCLString('hello'),
      }),
    )
    .payment(3_000_000_000)
    .chainName(CasperNetworkName.Testnet)
    .build(),
);

// WASM — SessionBuilder with a tiny module-bytes payload
writeFixture(
  'wasm-session',
  new SessionBuilder()
    .from(PublicKey.fromHex(SIGNING_KEY))
    .wasm(Conversions.decodeBase16('0061736d01000000'))
    .runtimeArgs(Args.fromMap({ danger: CLValue.newCLValueBool(false) }))
    .payment(15_000_000_000)
    .chainName(CasperNetworkName.Testnet)
    .build(),
);

// WASM_PROXY — SessionBuilder with `contract_package_hash` + `entry_point` + inner Args bytes.
// The wasmProxyAction handler decodes `args` as a serialized Args byte stream, so we feed
// a real, encoded Args payload here (not a free-form byte list).
{
  const innerArgs = Args.fromMap({
    amount: CLValue.newCLUInt512(1_000_000_000),
  });
  const innerBytes = innerArgs.toBytes();
  writeFixture(
    'wasm-proxy',
    new SessionBuilder()
      .from(PublicKey.fromHex(SIGNING_KEY))
      .wasm(Conversions.decodeBase16('0061736d01000000'))
      .runtimeArgs(
        Args.fromMap({
          contract_package_hash: CLValue.newCLByteArray(
            Conversions.decodeBase16(WASM_PROXY_PACKAGE_HASH),
          ),
          entry_point: CLValue.newCLString('buy'),
          args: CLValue.newCLList(
            CLTypeUInt8,
            Array.from(innerBytes).map(b => CLValue.newCLUint8(b)),
          ),
          attached_value: CLValue.newCLUInt512(1_000_000_000),
          amount: CLValue.newCLUInt512(1_000_000_000),
        }),
      )
      .payment(15_000_000_000)
      .chainName(CasperNetworkName.Testnet)
      .build(),
  );
}

// --- v0 Transaction (Deploy) fixtures ----------------------------------------

// Native CSPR transfer (legacy Deploy)
writeFixture(
  'legacy-cspr-transfer-deploy',
  Transaction.fromDeploy(
    makeCsprTransferDeploy({
      chainName: CasperNetworkName.Testnet,
      recipientPublicKeyHex: RECIPIENT,
      senderPublicKeyHex: SIGNING_KEY,
      transferAmount: '2500000000',
      memo: '1234',
    }),
  ),
);

// Auction delegate (legacy Deploy)
writeFixture(
  'legacy-auction-delegate-deploy',
  Transaction.fromDeploy(
    makeAuctionManagerDeploy({
      chainName: CasperNetworkName.Testnet,
      contractEntryPoint: AuctionManagerEntryPoint.delegate,
      amount: '2500000000',
      delegatorPublicKeyHex: SIGNING_KEY,
      validatorPublicKeyHex: VALIDATOR_A,
    }),
  ),
);

// CEP18 transfer (legacy Deploy)
writeFixture(
  'legacy-cep18-transfer-deploy',
  Transaction.fromDeploy(
    makeCep18TransferDeploy({
      chainName: CasperNetworkName.Testnet,
      recipientPublicKeyHex: RECIPIENT,
      senderPublicKeyHex: SIGNING_KEY,
      transferAmount: '100000000000000000',
      paymentAmount: '3000000000',
      contractPackageHash: CEP18_PACKAGE_HASH,
    }),
  ),
);

// Emit a tiny index that the test file imports. INDEX_PATH is a constant — no traversal risk.
fs.writeFileSync(
  INDEX_PATH,
  JSON.stringify(
    {
      signingKey: SIGNING_KEY,
      fixtures: Object.keys(fixtures),
    },
    null,
    2,
  ) + '\n',
);

console.log('Wrote %d fixtures to %s', Object.keys(fixtures).length, OUT_DIR);
console.log('Signing key: %s', SIGNING_KEY);
