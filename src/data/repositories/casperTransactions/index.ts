import { RpcClient, Transaction } from 'casper-js-sdk';
import { isBefore, sub } from 'date-fns';
import {
  AlreadySignedError,
  CasperNetwork,
  CasperTransactionsError,
  CasperTransactionsErrorType,
  CSPR_COIN,
  ICasperRpcOptions,
  ICasperTransactionsRepository,
  InvalidDeployError,
  isCasperTransactionsError,
  ISendDelegationParams,
  ISendDexTransactionParams,
  ISendNftTransferParams,
  ISendSignedTransactionParams,
  ISendTokenTransferParams,
  ISignMessageParams,
  ISignTransactionParams,
  ISignTransactionResponse,
  ILogger,
  LedgerError,
} from '../../../domain';
import { getBlockchainAmount } from '../../../utils/common';
import { isTransactionSignedBy } from '../../../utils/transactions';
import { createCasperRpcClient } from '../../../utils/casperSdk/rpcClient';
import {
  buildAuctionManagerTransactions,
  buildCep18TransferTransactions,
  buildCsprTransferTransactions,
  buildNftTransferTransactions,
  IBuiltCasperTransaction,
} from '../../../utils/casperSdk/tx-builders';

export class CasperTransactionsRepository implements ICasperTransactionsRepository {
  constructor(
    private _grpcUrl: Record<CasperNetwork, string>,
    private _rpcOptions: ICasperRpcOptions = {},
    private _log?: ILogger,
  ) {}

  async getNetworkApiVersion(network: CasperNetwork): Promise<string> {
    try {
      const resp = await this._createRpcClient(network).getStatus();

      return resp.apiVersion;
    } catch (e) {
      this._processError(e, 'getNetworkApiVersion');
    }
  }

  protected _createRpcClient(network: CasperNetwork): RpcClient {
    return createCasperRpcClient(this._grpcUrl[network], this._rpcOptions);
  }

  /**
   * Node time, or the device clock when the node cannot be read. The fallback is deliberate —
   * every transfer and delegation is timestamped from this — but a skewed device clock has the
   * node reject them as future-dated or expire them early, so a failed read is logged.
   */
  async getDateForTransaction(network: CasperNetwork): Promise<string> {
    const defaultDate = sub(new Date(), { seconds: 2 });

    try {
      const resp = await this._createRpcClient(network).getStatus();
      const nodeDate = resp.lastProgress.toDate();

      return isBefore(nodeDate, defaultDate) ? defaultDate.toISOString() : nodeDate.toISOString();
    } catch (e) {
      this._log?.reportError(
        e,
        'CasperTransactionsRepository.getDateForTransaction: falling back to the device clock',
      );

      return defaultDate.toISOString();
    }
  }

  async sendTokenTransfer(params: ISendTokenTransferParams): Promise<string> {
    try {
      const {
        token,
        network,
        casperNetworkApiVersion,
        toPublicKeyHex,
        amount,
        paymentAmount,
        memo,
        signer,
      } = params;
      const timestamp = await this.getDateForTransaction(network);

      const built = token.isNative
        ? buildCsprTransferTransactions(
            {
              network,
              senderPublicKeyHex: signer.publicKeyHex,
              recipientPublicKeyHex: toPublicKeyHex,
              transferAmountMotes: getBlockchainAmount(amount, CSPR_COIN.decimals),
              memo: memo ?? undefined,
              timestamp,
            },
            casperNetworkApiVersion,
          )
        : buildCep18TransferTransactions(
            {
              network,
              contractPackageHash: token.contractPackageHash,
              senderPublicKeyHex: signer.publicKeyHex,
              recipientPublicKeyHex: toPublicKeyHex,
              transferAmountMotes: getBlockchainAmount(amount, token.decimals),
              paymentAmountMotes: getBlockchainAmount(paymentAmount, CSPR_COIN.decimals),
              timestamp,
            },
            casperNetworkApiVersion,
          );

      return await this._signAndSubmit(built, params);
    } catch (e) {
      this._processError(e, 'sendTokenTransfer');
    }
  }

  async sendNftTransfer(params: ISendNftTransferParams): Promise<string> {
    try {
      const { nft, network, casperNetworkApiVersion, toPublicKeyHex, paymentAmount, signer } =
        params;
      const timestamp = await this.getDateForTransaction(network);

      const built = buildNftTransferTransactions(
        {
          network,
          contractPackageHash: nft.contractPackageHash,
          nftStandard: nft.standard,
          senderPublicKeyHex: signer.publicKeyHex,
          recipientPublicKeyHex: toPublicKeyHex,
          paymentAmountMotes: getBlockchainAmount(paymentAmount, CSPR_COIN.decimals),
          tokenId: nft.tokenIdType === 'uint' ? nft.tokenId : undefined,
          tokenHash: nft.tokenIdType === 'hash' ? nft.tokenId : undefined,
          timestamp,
        },
        casperNetworkApiVersion,
      );

      return await this._signAndSubmit(built, params);
    } catch (e) {
      this._processError(e, 'sendNftTransfer');
    }
  }

  async sendDelegation(params: ISendDelegationParams): Promise<string> {
    try {
      const {
        network,
        casperNetworkApiVersion,
        entryPoint,
        stake,
        paymentAmount,
        validatorPublicKeyHex,
        newValidatorPublicKeyHex,
        signer,
      } = params;
      const timestamp = await this.getDateForTransaction(network);

      const built = buildAuctionManagerTransactions(
        {
          network,
          entryPoint,
          delegatorPublicKeyHex: signer.publicKeyHex,
          validatorPublicKeyHex,
          newValidatorPublicKeyHex,
          amountMotes: getBlockchainAmount(stake, CSPR_COIN.decimals),
          paymentAmountMotes: getBlockchainAmount(paymentAmount, CSPR_COIN.decimals),
          timestamp,
        },
        casperNetworkApiVersion,
      );

      return await this._signAndSubmit(built, params);
    } catch (e) {
      this._processError(e, 'sendDelegation');
    }
  }

  async sendSignedTransaction({
    transaction,
    network,
    casperNetworkApiVersion,
  }: ISendSignedTransactionParams): Promise<string> {
    try {
      const rpcClient = this._createRpcClient(network);

      if (casperNetworkApiVersion.startsWith('2.')) {
        const resp = await rpcClient.putTransaction(transaction);

        if (!resp) {
          throw new InvalidDeployError('errors:deploy-rpc-error');
        }

        return resp.transactionHash.toHex();
      }

      const deploy = transaction.getDeploy();

      if (!deploy) {
        throw new InvalidDeployError('errors:deploy-rpc-error');
      }

      const resp = await rpcClient.putDeploy(deploy);

      if (!resp) {
        throw new InvalidDeployError('errors:deploy-rpc-error');
      }

      return resp.deployHash.toHex();
    } catch (e) {
      this._processError(e, 'sendSignedTransaction');
    }
  }

  async sendDexTransaction({ built, network, signer }: ISendDexTransactionParams): Promise<string> {
    try {
      const rpcClient = this._createRpcClient(network);

      if (built.deploy) {
        const signed = await signer.getSignedTransaction(Transaction.fromDeploy(built.deploy), {
          fallbackDeploy: built.deploy,
        });
        const deploy = signed.getDeploy();

        if (!deploy) {
          throw new InvalidDeployError('errors:deploy-rpc-error');
        }

        const resp = await rpcClient.putDeploy(deploy);

        if (!resp) {
          throw new InvalidDeployError('errors:deploy-rpc-error');
        }

        return resp.deployHash.toHex();
      }

      if (!built.transaction) {
        throw new InvalidDeployError('errors:deploy-rpc-error');
      }

      const signed = await signer.getSignedTransaction(built.transaction);
      const resp = await rpcClient.putTransaction(signed);

      if (!resp) {
        throw new InvalidDeployError('errors:deploy-rpc-error');
      }

      return resp.transactionHash.toHex();
    } catch (e) {
      this._processError(e, 'sendDexTransaction');
    }
  }

  async signTransaction({
    transaction,
    signer,
  }: ISignTransactionParams): Promise<ISignTransactionResponse> {
    try {
      if (isTransactionSignedBy(transaction, signer.publicKeyHex)) {
        throw new AlreadySignedError();
      }

      return await signer.signTransaction(transaction);
    } catch (e) {
      this._processError(e, 'signTransaction');
    }
  }

  async signMessage({ message, signer }: ISignMessageParams): Promise<Uint8Array> {
    try {
      return await signer.signMessage(message);
    } catch (e) {
      this._processError(e, 'signMessage');
    }
  }

  private async _signAndSubmit(
    built: IBuiltCasperTransaction,
    params: Pick<ISendTokenTransferParams, 'signer' | 'network' | 'casperNetworkApiVersion'>,
  ): Promise<string> {
    const signedTx = await params.signer.getSignedTransaction(built.transaction, {
      fallbackDeploy: built.fallbackDeploy,
    });

    return this.sendSignedTransaction({
      transaction: signedTx,
      network: params.network,
      casperNetworkApiVersion: params.casperNetworkApiVersion,
    });
  }

  protected _processError(e: unknown, type: CasperTransactionsErrorType): never {
    if (
      isCasperTransactionsError(e) ||
      e instanceof InvalidDeployError ||
      e instanceof LedgerError
    ) {
      throw e;
    }

    throw new CasperTransactionsError(e, type);
  }
}
