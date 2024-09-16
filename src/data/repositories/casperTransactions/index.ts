import {
  CLPublicKey,
  CLPublicKeyTag,
  CLValueBuilder,
  decodeBase64,
  InitiatorAddr,
  Keys,
  RuntimeArgs,
  TransactionUtil,
  TransactionTarget,
  TransactionEntryPoint,
  TransactionScheduling,
  CLU64,
  CLU64Type,
  TransactionRuntime,
  TransactionInvocationTarget,
} from 'casper-js-sdk';
import { sub } from 'date-fns';
import { Some } from 'ts-results';

import {
  CASPER_MESSAGE_HEADER,
  CasperTransactionsError,
  CSPR_API_PROXY_HEADERS,
  CSPR_COIN,
  EmptySignatureError,
  GrpcUrl,
  isCasperTransactionsError,
  UnknownSignatureTypeError,
  DEFAULT_DEPLOY_TTL,
  ICasperTransactionsRepository,
  ISendTokenTransferTransactionParams,
  ISendNftTransferTransactionParams,
  ISendDelegationTransactionParams,
} from '../../../domain';
import { getBlockchainAmount } from '../../../utils';
import { IHttpDataProvider, Network } from '../../../domain';
import { ICasperNodeStatusResponse } from './types';

export class CasperTransactionsRepository implements ICasperTransactionsRepository {
  constructor(private _httpProvider: IHttpDataProvider) {}

  async sendTokenTransferTransaction({
    token,
    memo,
    network,
    activeAccount,
    ...params
  }: ISendTokenTransferTransactionParams): Promise<string> {
    try {
      const transaction = await (token.isNative
        ? this._makeCsprTransferTransaction({
            network,
            memo,
            activeAccount,
            ...params,
          })
        : this._makeCep18TransferTransaction({
            token,
            network,
            activeAccount,
            ...params,
          }));

      return this._sendTransaction(transaction);
    } catch (e) {
      this._processError(e, 'sendTokenTransferTransaction');
    }
  }

  async sendNftTransferTransaction({
    activeAccount,
    network,
    ...rest
  }: ISendNftTransferTransactionParams): Promise<string> {
    try {
      const transaction = await this._makeNftTransferTransaction({
        activeAccount,
        network,
        ...rest,
      });

      return this._sendTransaction(transaction);
    } catch (e) {
      this._processError(e, 'sendNftTransferTransaction');
    }
  }

  async sendDelegationTransaction({
    activeAccount,
    network,
    ...rest
  }: ISendDelegationTransactionParams): Promise<string> {
    try {
      const transaction = await this._makeDelegationTransaction({
        activeAccount,
        network,
        ...rest,
      });

      return this._sendTransaction(transaction);
    } catch (e) {
      this._processError(e, 'sendDelegationTransaction');
    }
  }

  signDeploy = (
    deployHash: Uint8Array,
    publicKeyHex: string,
    privateKeyBase64: string,
  ): Uint8Array => {
    try {
      // signature is a signed deploy hash
      return this._sign(deployHash, publicKeyHex, privateKeyBase64);
    } catch (e) {
      this._processError(e, 'signDeploy');
    }
  };

  signMessage = (message: string, publicKeyHex: string, privateKeyBase64: string): Uint8Array => {
    try {
      const messageHash = Uint8Array.from(
        Buffer.from(this._createMessageBytesWithHeaders(message)),
      );

      return this._sign(messageHash, publicKeyHex, privateKeyBase64);
    } catch (e) {
      this._processError(e, 'signMessage');
    }
  };

  validatePublicKey(publicKey: string) {
    if (!publicKey) {
      return false;
    }

    const ED25519_KEY_ALGO_PREFIX = '01';
    const SECP256K1_KEY_ALGO_PREFIX = '02';
    const publicKeyRegExp = new RegExp(/^[a-fA-F0-9]*$/);

    if (!publicKeyRegExp.test(publicKey)) {
      return false;
    }

    const prefix = publicKey.slice(0, 2);
    if (
      (prefix === ED25519_KEY_ALGO_PREFIX && publicKey.length !== 66) ||
      (prefix === SECP256K1_KEY_ALGO_PREFIX && publicKey.length !== 68)
    ) {
      return false;
    }

    try {
      CLPublicKey.fromFormattedString(publicKey).toFormattedString(false);
      return true;
    } catch (error) {
      return false;
    }
  }

  async _makeCsprTransferTransaction({
    network,
    activeAccount,
    toAccount,
    amount,
  }: Omit<ISendTokenTransferTransactionParams, 'token'>) {
    const date = await this._getDateForDeploy(network);
    const keys = this._createAsymmetricKey(activeAccount.publicKey, activeAccount.secretKey);

    const initiatorAddr = CLPublicKey.fromFormattedString(activeAccount.publicKey);

    const transactionParams = new TransactionUtil.Version1Params(
      InitiatorAddr.InitiatorAddr.fromPublicKey(initiatorAddr),
      date,
      DEFAULT_DEPLOY_TTL,
      'dev-net',
      TransactionUtil.PricingMode.buildFixed(100),
    );

    const runtimeArgs = RuntimeArgs.fromMap({
      target: CLPublicKey.fromFormattedString(toAccount),
      amount: CLValueBuilder.u512(getBlockchainAmount(amount, CSPR_COIN.decimals)),
      id: CLValueBuilder.option(Some(new CLU64(date)), new CLU64Type()),
    });

    const transactionTarget = new TransactionTarget.Native();
    const transactionEntryPoint = new TransactionEntryPoint.Transfer();
    const transactionScheduling = new TransactionScheduling.Standard();

    const transaction = TransactionUtil.makeV1Transaction(
      transactionParams,
      runtimeArgs,
      transactionTarget,
      transactionEntryPoint,
      transactionScheduling,
      TransactionUtil.TransactionCategoryMint,
    );

    return TransactionUtil.signTransaction(transaction, keys);
  }

  async _makeCep18TransferTransaction({
    token,
    network,
    toAccount,
    activeAccount,
    amount,
  }: Omit<ISendTokenTransferTransactionParams, 'memo'>) {
    const date = await this._getDateForDeploy(network);

    const keys = this._createAsymmetricKey(activeAccount.publicKey, activeAccount.secretKey);

    const byHash = new TransactionInvocationTarget.TransactionInvocationTarget();
    const transactionScheduling = new TransactionScheduling.Standard();

    const transferArgs = RuntimeArgs.fromMap({
      recipient: CLPublicKey.fromFormattedString(toAccount).toAccountHash(),
      amount: CLValueBuilder.u256(getBlockchainAmount(amount, token.decimals)),
    });

    const initiatorAddr = CLPublicKey.fromFormattedString(activeAccount.publicKey);

    const runEndpointParams = new TransactionUtil.Version1Params(
      InitiatorAddr.InitiatorAddr.fromPublicKey(initiatorAddr),
      date,
      DEFAULT_DEPLOY_TTL,
      'dev-net',
      TransactionUtil.PricingMode.buildFixed(3), // TODO: Consider to use paymentAmount here
    );

    byHash.ByName = `cep18_contract_hash_${token.name}`;

    const runEndpointTransaction = TransactionUtil.makeV1Transaction(
      runEndpointParams,
      transferArgs,
      TransactionTarget.Stored.build(byHash, TransactionRuntime.VmCasperV1),
      TransactionEntryPoint.Custom.build('transfer'),
      transactionScheduling,
      TransactionUtil.TransactionCategoryLarge,
    );

    return runEndpointTransaction.sign([keys]);
  }

  async _makeNftTransferTransaction({
    nft,
    network,
    toAccount,
    activeAccount,
  }: ISendNftTransferTransactionParams) {
    const date = await this._getDateForDeploy(network);
    const keys = this._createAsymmetricKey(activeAccount.publicKey, activeAccount.secretKey);
    const initiatorAddr = CLPublicKey.fromFormattedString(activeAccount.publicKey);

    const transferArgs = RuntimeArgs.fromMap({
      recipient: CLPublicKey.fromFormattedString(toAccount).toAccountHash(),
      token_ids: CLValueBuilder.list([nft.tokenId!].map(id => CLValueBuilder.u256(id))),
      id: CLValueBuilder.option(Some(new CLU64(date)), new CLU64Type()),
    });

    const runEndpointParams = new TransactionUtil.Version1Params(
      InitiatorAddr.InitiatorAddr.fromPublicKey(initiatorAddr),
      date,
      DEFAULT_DEPLOY_TTL,
      'dev-net',
      TransactionUtil.PricingMode.buildFixed(3), // TODO: Consider to use paymentAmount here
    );

    const transactionTarget = new TransactionTarget.Native();
    const transactionEntryPoint = new TransactionEntryPoint.Transfer();
    const transactionScheduling = new TransactionScheduling.Standard();

    const transaction = TransactionUtil.makeV1Transaction(
      runEndpointParams,
      transferArgs,
      transactionTarget,
      transactionEntryPoint,
      transactionScheduling,
      TransactionUtil.TransactionCategoryLarge,
    );

    return TransactionUtil.signTransaction(transaction, keys);
  }

  async _makeDelegationTransaction({
    network,
    entryPoint,
    newValidatorPublicKeyHex,
    validatorPublicKeyHex,
    activeAccount,
    stake,
  }: ISendDelegationTransactionParams) {
    const date = await this._getDateForDeploy(network);
    const initiatorAddr = CLPublicKey.fromFormattedString(activeAccount.publicKey);

    const keys = this._createAsymmetricKey(activeAccount.publicKey, activeAccount.secretKey);

    const runEndpointParams = new TransactionUtil.Version1Params(
      InitiatorAddr.InitiatorAddr.fromPublicKey(initiatorAddr),
      date,
      DEFAULT_DEPLOY_TTL,
      'dev-net',
      TransactionUtil.PricingMode.buildFixed(3), // TODO: Consider to use paymentAmount here
    );

    const runtimeArgs = RuntimeArgs.fromMap({
      validator: CLPublicKey.fromFormattedString(validatorPublicKeyHex),
      delegator: keys.publicKey,
      amount: CLValueBuilder.u512(getBlockchainAmount(stake, CSPR_COIN.decimals)),
      ...(newValidatorPublicKeyHex
        ? {
            new_validator: CLPublicKey.fromFormattedString(newValidatorPublicKeyHex),
          }
        : {}),
    });

    const transactionTarget = new TransactionTarget.Native();
    let transactionEntryPoint;
    const transactionScheduling = new TransactionScheduling.Standard();

    if (entryPoint === 'DELEGATE') {
      transactionEntryPoint = new TransactionEntryPoint.Delegate();
    } else if (entryPoint === 'REDELEGATE') {
      transactionEntryPoint = new TransactionEntryPoint.Redelegate();
    } else if (entryPoint === 'UNDELEGATE') {
      transactionEntryPoint = new TransactionEntryPoint.Undelegate();
    }

    const transaction = TransactionUtil.makeV1Transaction(
      runEndpointParams,
      runtimeArgs,
      transactionTarget,
      transactionEntryPoint as TransactionEntryPoint.TransactionEntryPoint,
      transactionScheduling,
      TransactionUtil.TransactionCategoryAuction,
    );

    return TransactionUtil.signTransaction(transaction, keys);
  }

  private async _sendTransaction(signedTransaction: TransactionUtil.Transaction): Promise<string> {
    //HTTP requests blocked

    // const client = new CasperServiceByJsonRPC('http://3.20.57.210:7777/rpc');
    // await client.transaction(signedTransaction);
    // await delay(2500);
    // const result = await client.waitForTransaction(signedTransaction, 100000);

    /**
     * Example of the result
     * {"jsonrpc":"2.0","id":"1723737816548","result":{"api_version":"2.0.0","transaction_hash":{"Version1":"bbd8808bf70a3caf3b72941b77aeb64e806241b7b619aa9fa6ad9a28453dd9d1"}}}
     */

    console.log(JSON.stringify(TransactionUtil.transactionToJson(signedTransaction).transaction));

    // const resp = await this._httpProvider.post({
    //   url: 'http://3.20.57.210:7777/rpc',
    //   data: {
    //     jsonrpc: '2.0',
    //     method: 'account_put_transaction',
    //     params: [TransactionUtil.transactionToJson(signedTransaction).transaction],
    //     id: new Date().getTime(),
    //   },
    //   errorType: 'deployRpcError',
    // });
    //
    return '';
  }

  private _sign(data: Uint8Array, publicKeyHex: string, privateKeyBase64: string): Uint8Array {
    const clPublicKey = CLPublicKey.fromFormattedString(publicKeyHex);
    const publicKey = clPublicKey.value();
    const secretKey = decodeBase64(privateKeyBase64);

    let keyPair: Keys.AsymmetricKey;

    switch (clPublicKey.tag) {
      case CLPublicKeyTag.ED25519:
        keyPair = new Keys.Ed25519({ publicKey, secretKey });
        break;

      case CLPublicKeyTag.SECP256K1:
        keyPair = new Keys.Secp256K1(publicKey, secretKey);
        break;

      default:
        throw new UnknownSignatureTypeError();
    }

    const signature = keyPair.sign(data);

    if (!signature) {
      throw new EmptySignatureError();
    }

    return signature;
  }

  private _getDateForDeploy = async (network: Network): Promise<number> => {
    const defaultDate = sub(new Date(), { seconds: 2 }).getTime();

    try {
      const casperNodeTimestamp = await this._httpProvider.get<ICasperNodeStatusResponse>({
        url: `${GrpcUrl[network]}/info_get_status`,
        errorType: 'deployRpcError',
        headers: CSPR_API_PROXY_HEADERS,
      });

      return casperNodeTimestamp?.last_progress
        ? new Date(casperNodeTimestamp?.last_progress).getTime()
        : defaultDate;
    } catch {
      return defaultDate;
    }
  };

  private _createAsymmetricKey = (publicKey: string, secretKey: string): Keys.AsymmetricKey => {
    const clPublicKey = CLPublicKey.fromFormattedString(publicKey);
    const decodedSecretKey = decodeBase64(secretKey);

    switch (clPublicKey.tag) {
      case CLPublicKeyTag.ED25519:
        return new Keys.Ed25519({
          publicKey: clPublicKey.value(),
          secretKey: decodedSecretKey,
        });

      case CLPublicKeyTag.SECP256K1:
        return new Keys.Secp256K1(clPublicKey.value(), decodedSecretKey);

      default:
        throw new UnknownSignatureTypeError();
    }
  };

  /**
   * Prepends the string with Casper message header and converts to the byte array.
   * @param message The string to be formatted.
   * @returns The bytes of the formatted message
   */
  private _createMessageBytesWithHeaders = (message: string): Uint8Array => {
    // Avoiding usage of Text Encoder lib to support legacy nodejs versions.
    const messageWithHeader = `${CASPER_MESSAGE_HEADER}${message}`;
    return Uint8Array.from(Buffer.from(messageWithHeader));
  };

  private _processError(e: unknown, type: keyof ICasperTransactionsRepository): never {
    if (isCasperTransactionsError(e)) {
      throw e;
    }

    throw new CasperTransactionsError(e, type);
  }
}
