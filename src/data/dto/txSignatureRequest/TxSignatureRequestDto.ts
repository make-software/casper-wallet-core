import { Transaction, TransactionEntryPointEnum, StateGetAccountInfo } from 'casper-js-sdk';

import {
  AccountKeyType,
  AssociatedKeysContractInfo,
  AuctionManagerContractInfo,
  CasperNetwork,
  CSPR_COIN,
  CSPRMarketContractInfo,
  IAccountInfo,
  IContractInfo,
  ISignaturesCollectedInfo,
  ITxSignatureRequest,
  ITxSignatureRequestActionUnion,
} from '../../../domain';
import { Maybe } from '../../../typings';
import { formatTokenBalance, isKeysEqual } from '../../../utils';
import { ContractTypeId, deriveKeyType, getAccountInfoFromMap, getCsprFiatAmount } from '../common';
import { IContractPackageCloudResponse } from '../../repositories';
import {
  getTxSignatureRequestAssociatedKeysAction,
  getTxSignatureRequestAuctionAction,
  getTxSignatureRequestCasperMarketAction,
  getTxSignatureRequestCep18Action,
  getTxSignatureRequestNativeCsprAction,
  getTxSignatureRequestNFTAction,
  getTxSignatureRequestUnknownContractAction,
  getTxSignatureRequestWasmAction,
  getTxSignatureRequestWasmProxyAction,
} from './actions';
import { checkIsWasmProxyTx } from './common';

export interface TxSignatureRequestDtoProps {
  tx: Transaction;
  network: Maybe<CasperNetwork>;
  signingPublicKeyHex: string;
  csprFiatRate: string;
  accountInfoMap: Record<string, IAccountInfo>;
  contractPackage: Maybe<IContractPackageCloudResponse>;
  rpcAccountInfo: Maybe<StateGetAccountInfo>;
  isWasmProxyOnApi: Maybe<boolean>;
}

export class TxSignatureRequestDto implements ITxSignatureRequest {
  constructor({
    tx,
    network,
    signingPublicKeyHex,
    csprFiatRate,
    accountInfoMap = {},
    contractPackage,
    rpcAccountInfo,
    isWasmProxyOnApi,
  }: TxSignatureRequestDtoProps) {
    this.txHash = tx.hash.toHex();
    this.id = this.txHash;
    this.chainName = tx.chainName;
    this.expires = new Date(tx.timestamp.toMilliseconds() + tx.ttl.toMilliseconds()).toISOString();
    this.rawJson = JSON.stringify(tx.toJSON(), null, ' ');

    const signingKeyType = deriveKeyType(signingPublicKeyHex);
    this.signingAccountInfo = getAccountInfoFromMap(
      accountInfoMap,
      signingPublicKeyHex,
      signingKeyType,
    );
    this.signingKey = this.signingAccountInfo?.publicKey ?? signingPublicKeyHex;
    this.signingKeyType = this.signingAccountInfo?.publicKey ? 'publicKey' : signingKeyType;

    const senderKey =
      tx.initiatorAddr.publicKey?.toHex() ?? tx.initiatorAddr.accountHash?.toHex() ?? '';
    const senderKeyType = deriveKeyType(senderKey);
    this.senderAccountInfo = getAccountInfoFromMap(accountInfoMap, senderKey, senderKeyType);
    this.senderKey = this.senderAccountInfo?.publicKey ?? senderKey;
    this.senderKeyType = this.senderAccountInfo?.publicKey ? 'publicKey' : senderKeyType;

    this.paymentAmount = getTxPayment(tx);
    this.formattedPaymentAmount = formatTokenBalance(this.paymentAmount, CSPR_COIN.decimals);
    this.fiatPaymentAmount = getCsprFiatAmount(this.paymentAmount, csprFiatRate);

    this.memo = getTxMemo(tx);
    this.signaturesCollected = getSignaturesCollected(tx, accountInfoMap, rpcAccountInfo);

    this.action = getTxSignatureRequestAction(
      tx,
      csprFiatRate,
      network,
      signingPublicKeyHex,
      accountInfoMap,
      contractPackage,
      isWasmProxyOnApi ?? false,
    );
  }

  readonly id: string;
  readonly txHash: string;
  readonly chainName: string;
  readonly expires: string;
  readonly memo: Maybe<string>;
  readonly rawJson: string;

  readonly action: ITxSignatureRequestActionUnion;

  readonly senderKey: string;
  readonly senderKeyType: AccountKeyType;
  readonly senderAccountInfo: Maybe<IAccountInfo>;

  readonly signingKey: string;
  readonly signingAccountInfo: Maybe<IAccountInfo>;
  readonly signingKeyType: AccountKeyType;

  readonly paymentAmount: string;
  readonly formattedPaymentAmount: string;
  readonly fiatPaymentAmount: string;

  readonly signaturesCollected: ISignaturesCollectedInfo[];
}

export function getTxSignatureRequestAction(
  tx: Transaction,
  csprFiatRate: string,
  network: Maybe<CasperNetwork>,
  signingPublicKeyHex: string,
  accountInfoMap: Record<string, IAccountInfo> = {},
  contractPackage: Maybe<IContractPackageCloudResponse>,
  isWasmProxyOnApi: boolean,
): ITxSignatureRequestActionUnion {
  const entryPointType: TransactionEntryPointEnum = tx.entryPoint.type;
  const contractTypeId = contractPackage?.latest_version_contract_type_id;

  switch (entryPointType) {
    case TransactionEntryPointEnum.Transfer:
      return getTxSignatureRequestNativeCsprAction(tx, csprFiatRate, accountInfoMap);

    case TransactionEntryPointEnum.AddBid:
    case TransactionEntryPointEnum.WithdrawBid:
    case TransactionEntryPointEnum.Delegate:
    case TransactionEntryPointEnum.Undelegate:
    case TransactionEntryPointEnum.Redelegate:
    case TransactionEntryPointEnum.ActivateBid:
    case TransactionEntryPointEnum.ChangeBidPublicKey:
    case TransactionEntryPointEnum.AddReservations:
    case TransactionEntryPointEnum.CancelReservations:
      return getTxSignatureRequestAuctionAction(
        tx,
        accountInfoMap,
        csprFiatRate,
        signingPublicKeyHex,
        contractPackage,
      );

    case TransactionEntryPointEnum.Call: {
      const isWasmProxyTx = checkIsWasmProxyTx(tx, isWasmProxyOnApi);

      if (isWasmProxyTx) {
        return (
          getTxSignatureRequestWasmProxyAction(tx, accountInfoMap, contractPackage) ??
          getTxSignatureRequestWasmAction(tx, accountInfoMap)
        );
      }

      return getTxSignatureRequestWasmAction(tx, accountInfoMap);
    }

    case TransactionEntryPointEnum.Custom: {
      if (network && isContractSpecificContractCall(tx, AuctionManagerContractInfo[network])) {
        return getTxSignatureRequestAuctionAction(
          tx,
          accountInfoMap,
          csprFiatRate,
          signingPublicKeyHex,
          contractPackage,
        );
      } else if (
        network &&
        isContractSpecificContractCall(tx, AssociatedKeysContractInfo[network])
      ) {
        return getTxSignatureRequestAssociatedKeysAction(tx, contractPackage);
      } else if (network && isContractSpecificContractCall(tx, CSPRMarketContractInfo[network])) {
        return getTxSignatureRequestCasperMarketAction(
          tx,
          accountInfoMap,
          csprFiatRate,
          contractPackage,
        );
      } else if (
        contractTypeId === ContractTypeId.CustomCep18 ||
        contractTypeId === ContractTypeId.Cep18
      ) {
        return getTxSignatureRequestCep18Action(tx, accountInfoMap, contractPackage);
      } else if (
        contractTypeId === ContractTypeId.CEP78Nft ||
        contractTypeId === ContractTypeId.CEP47Nft ||
        contractTypeId === ContractTypeId.CustomCEP78Nft ||
        contractTypeId === ContractTypeId.CustomCEP47Nft
      ) {
        return getTxSignatureRequestNFTAction(tx, accountInfoMap, contractPackage);
      }

      return getTxSignatureRequestUnknownContractAction(tx, accountInfoMap, contractPackage);
    }
    default:
      return getTxSignatureRequestUnknownContractAction(tx, accountInfoMap, contractPackage);
  }
}

function getTxMemo(tx: Transaction): Maybe<string> {
  if (tx?.entryPoint?.type === TransactionEntryPointEnum.Transfer) {
    return tx.args.getByName('id')?.toString() ?? null;
  }

  return null;
}

function getSignaturesCollected(
  tx: Transaction,
  accountInfoMap: Record<string, IAccountInfo> = {},
  rpcAccountInfo: Maybe<StateGetAccountInfo>,
): ISignaturesCollectedInfo[] {
  return tx.approvals
    .map(ap => ap.signer)
    .map<ISignaturesCollectedInfo>(pk => ({
      publicKey: pk.toHex(),
      accountInfo: getAccountInfoFromMap(accountInfoMap, pk.accountHash().toHex(), 'accountHash'),
      weight:
        rpcAccountInfo?.account?.associatedKeys?.find(k =>
          isKeysEqual(k.accountHash.toHex(), pk.accountHash().toHex()),
        )?.weight ?? null,
    }));
}

function getTxPayment(tx: Transaction): string {
  const limitedPaymentAmount = tx.pricingMode.paymentLimited?.paymentAmount;

  if (limitedPaymentAmount) {
    return limitedPaymentAmount.toString();
  } else {
    return 'N/A';
  }
}

function isContractSpecificContractCall(tx: Transaction, contractInfo: IContractInfo): boolean {
  if (tx?.entryPoint?.type !== TransactionEntryPointEnum.Custom) {
    return false;
  }

  const storedTargetId = tx.target.stored?.id;

  return (
    storedTargetId?.byHash?.toHex() === contractInfo.contractHash ||
    storedTargetId?.byPackageHash?.addr?.toHex() === contractInfo.contractPackageHash ||
    storedTargetId?.byName === contractInfo.contactName ||
    storedTargetId?.byPackageName?.name === contractInfo.contractPackageName
  );
}
