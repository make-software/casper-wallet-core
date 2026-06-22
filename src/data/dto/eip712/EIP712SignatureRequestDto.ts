import { Maybe } from '../../../typings';
import {
  AccountKeyType,
  CasperNetwork,
  IAccountInfo,
  IContractPackage,
  IEIP712DisplayRow,
  IEIP712Enrichment,
  IEIP712HashArtifacts,
  IEIP712SignatureRequest,
  IEIP712TypedData,
} from '../../../domain';
import { buildTypedDataDisplayModel } from '../../../utils';
import { deriveKeyType, getAccountInfoFromMap } from '../common';
import { EIP712_CHAIN_NAME_KEY, resolveEip712AddressToAccountHash } from './common';

export interface IEIP712SignatureRequestDtoProps {
  typedData: IEIP712TypedData;
  signingPublicKeyHex: string;
  network: Maybe<CasperNetwork>;
  digest: string;
  hashArtifacts?: IEIP712HashArtifacts;
  accountInfoMap: Record<string, IAccountInfo>;
  contractPackage: Maybe<IContractPackage>;
  enrichment: IEIP712Enrichment;
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
  readonly enrichment: IEIP712Enrichment;

  constructor({
    typedData,
    signingPublicKeyHex,
    network,
    digest,
    hashArtifacts,
    accountInfoMap,
    contractPackage,
    enrichment,
  }: IEIP712SignatureRequestDtoProps) {
    const { domainRows, messageRows } = buildTypedDataDisplayModel(
      typedData,
      {
        resolveAccountInfo: value => {
          // address values may be a Casper public key or account hash — resolve to account hash first,
          // then look up by it so the key matches what getAccountHashesFromTypedData fetched.
          const accountHash = resolveEip712AddressToAccountHash(value);
          return accountHash
            ? (getAccountInfoFromMap(accountInfoMap, accountHash, 'accountHash') ?? null)
            : null;
        },
        contractPackage,
      },
      [EIP712_CHAIN_NAME_KEY],
    );

    const signingKeyType = deriveKeyType(signingPublicKeyHex);
    // getAccountInfoFromMap yields runtime `undefined` for a missing key; normalize to null for Maybe<>.
    this.signingAccountInfo =
      getAccountInfoFromMap(accountInfoMap, signingPublicKeyHex, signingKeyType) ?? null;
    this.signingKey = this.signingAccountInfo?.publicKey || signingPublicKeyHex;
    this.signingKeyType = this.signingAccountInfo?.publicKey ? 'publicKey' : signingKeyType;

    this.network = network;
    this.chainName = String(typedData.domain[EIP712_CHAIN_NAME_KEY] ?? '');
    this.primaryType = typedData.primaryType;
    this.domainRows = domainRows;
    this.messageRows = messageRows;
    this.digest = digest;
    this.hashArtifacts = hashArtifacts;
    this.rawJson = JSON.stringify(typedData, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    );
    this.enrichment = enrichment;
    this.id = digest;
  }
}
