import { Maybe } from '../../typings';

export interface IEIP712Field {
  name: string;
  type: string;
}

export type IEIP712Types = Record<string, IEIP712Field[]>;

export interface IEIP712TypedData {
  domain: Record<string, unknown>;
  types: IEIP712Types;
  primaryType: string;
  message: Record<string, unknown>;
}

export interface IEIP712SignTypedDataOptions {
  domainTypes?: IEIP712Field[];
  returnHashArtifacts?: boolean;
  rejectUnknownFields?: boolean;
}

export interface IEIP712HashArtifacts {
  domainTypeString: string;
  domain: Record<string, unknown>;
  domainSeparator: string;
  structHash: string;
  canonicalTypeString: string;
  typeHash: string;
}

export interface IEIP712Digest {
  digest: string;
  resolvedDomainTypes: IEIP712Field[];
  hashArtifacts?: IEIP712HashArtifacts;
}

export interface IEIP712DisplayRow {
  label: string;
  value: string;
  displayValue: string;
  isAddress: boolean;
  copyValue: Maybe<string>;
  type: string;
}

export interface IEIP712DisplayModel {
  domainRows: IEIP712DisplayRow[];
  messageRows: IEIP712DisplayRow[];
  primaryType: string;
}

export type EIP712SignatureScheme = 'ed25519' | 'secp256k1';

export interface IEIP712SignResult {
  signature: string;
  digest: string;
  publicKey: string;
  hashArtifacts?: IEIP712HashArtifacts;
}
