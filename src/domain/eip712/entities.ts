import { Maybe } from '../../typings';
import { AccountKeyType } from '../deploys';
import { CasperNetwork, IEntity } from '../common';
import { IAccountInfo } from '../accountInfo';
import { IContractPackage } from '../contractPackage';

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

export type EIP712FieldPresentation = 'hash' | 'number' | 'account' | 'string' | 'date';

export interface IEIP712DisplayRow {
  label: string;
  value: string;
  displayValue: string;
  presentation: EIP712FieldPresentation;
  type: string;
  copyValue: Maybe<string>;
  accountInfo: Maybe<IAccountInfo>;
  contractPackage: Maybe<IContractPackage>;
}

export interface IEIP712DisplayModel {
  domainRows: IEIP712DisplayRow[];
  messageRows: IEIP712DisplayRow[];
  primaryType: string;
}

/** Outcome of a best-effort enrichment lookup, so consumers can tell a failed lookup from absent data. */
export type EIP712EnrichmentStatus = 'ok' | 'failed' | 'skipped';
/**
 * Contract-package enrichment adds `absent` ("no `contract_package_hash` in the domain") and
 * `partial` (some package lookups succeeded while others threw — degraded, not fully failed).
 */
export type EIP712ContractEnrichmentStatus = EIP712EnrichmentStatus | 'absent' | 'partial';

export interface IEIP712Enrichment {
  /** Account-info batch: `skipped` (no network), `ok` (batch succeeded), `failed` (batch threw). */
  accounts: EIP712EnrichmentStatus;
  /**
   * Contract package: `skipped`, `absent`, `ok` (all lookups completed), `partial` (some succeeded,
   * some threw), `failed` (every lookup threw).
   */
  contractPackage: EIP712ContractEnrichmentStatus;
}

export type EIP712SignatureScheme = 'ed25519' | 'secp256k1';

export interface IEIP712SignResult {
  signature: string;
  digest: string;
  publicKey: string;
  hashArtifacts?: IEIP712HashArtifacts;
}

export interface IEIP712SignatureRequest extends IEntity {
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
}
