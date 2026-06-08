import { Maybe } from '../../../typings';
import {
  AccountKeyType,
  CasperNetwork,
  IAccountInfo,
  IContractPackage,
  IEIP712DisplayRow,
  IEIP712HashArtifacts,
  IEIP712SignatureRequest,
  IEIP712TypedData,
} from '../../../domain';
import { buildTypedDataDisplayModel } from '../../../utils';
import { deriveKeyType, getAccountInfoFromMap } from '../common';

export interface IEIP712SignatureRequestDtoProps {
  typedData: IEIP712TypedData;
  signingPublicKeyHex: string;
  network: Maybe<CasperNetwork>;
  digest: string;
  hashArtifacts?: IEIP712HashArtifacts;
  accountInfoMap: Record<string, IAccountInfo>;
  contractPackage: Maybe<IContractPackage>;
}

export class EIP712SignatureRequestDto implements IEIP712SignatureRequest {
  readonly id: string;
  readonly signingKey: string;
  readonly signingKeyType: AccountKeyType;
  readonly signingAccountInfo: Maybe<IAccountInfo>;
  readonly network: Maybe<CasperNetwork>;
  readonly chainName: string;
  readonly primaryType: string;
  readonly domainRows: IEIP712DisplayRow[];
  readonly messageRows: IEIP712DisplayRow[];
  readonly digest: string;
  readonly hashArtifacts?: IEIP712HashArtifacts;
  readonly rawJson: string;

  constructor({
    typedData,
    signingPublicKeyHex,
    network,
    digest,
    hashArtifacts,
    accountInfoMap,
    contractPackage,
  }: IEIP712SignatureRequestDtoProps) {
    const { domainRows, messageRows } = buildTypedDataDisplayModel(typedData, {
      resolveAccountInfo: value => getAccountInfoFromMap(accountInfoMap, value, 'accountHash'),
      contractPackage,
    });

    const signingKeyType = deriveKeyType(signingPublicKeyHex);
    // getAccountInfoFromMap yields runtime `undefined` for a missing key; normalize to null for Maybe<>.
    this.signingAccountInfo =
      getAccountInfoFromMap(accountInfoMap, signingPublicKeyHex, signingKeyType) ?? null;
    this.signingKey = this.signingAccountInfo?.publicKey || signingPublicKeyHex;
    this.signingKeyType = this.signingAccountInfo?.publicKey ? 'publicKey' : signingKeyType;

    this.network = network;
    this.chainName = String(typedData.domain.chain_name ?? '');
    this.primaryType = typedData.primaryType;
    this.domainRows = domainRows;
    this.messageRows = messageRows;
    this.digest = digest;
    this.hashArtifacts = hashArtifacts;
    this.rawJson = JSON.stringify(typedData);
    this.id = digest;
  }
}
