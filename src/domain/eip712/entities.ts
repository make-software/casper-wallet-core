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

/** One step from the message or domain root: a field name, or a zero-based array index. */
export type EIP712PathSegment = string | number;

/** The CEP-18 token an amount row is denominated in. */
export interface IEIP712RowToken {
  contractPackageHash: string;
  symbol: string;
  decimals: number;
}

/** `path`, `depth`, `token` and `isAmount` are set on every row the library builds. */
export interface IEIP712DisplayRow {
  label: string;
  value: string;
  displayValue: string;
  presentation: EIP712FieldPresentation;
  type: string;
  copyValue: Maybe<string>;
  accountInfo: Maybe<IAccountInfo>;
  contractPackage: Maybe<IContractPackage>;
  /** Field names and array indexes from the root to this value; `['spender']` for a top-level field. */
  path?: EIP712PathSegment[];
  /** Struct nesting of the value: 0 for a top-level field; array indexes do not count. */
  depth?: number;
  /**
   * CEP-18 token of an `amount`/`value` row: its sibling `token` address, or for a top-level amount
   * with no `token` field the domain package. Null when unpaired or not CEP-18 with metadata.
   */
  token?: Maybe<IEIP712RowToken>;
  /**
   * True for an amount shown in token units or as `Unlimited`: a `number` row whose `displayValue`
   * differs from `value`, so render `displayValue`.
   */
  isAmount?: boolean;
}

export interface IEIP712DisplayModel {
  domainRows: IEIP712DisplayRow[];
  messageRows: IEIP712DisplayRow[];
  primaryType: string;
}

/**
 * Outcome of a best-effort enrichment lookup. For contract packages, a lookup that returned no data
 * counts as failed, like one that threw. `skipped` is no longer produced: a valid domain always
 * names a network.
 */
export type EIP712EnrichmentStatus = 'ok' | 'failed' | 'skipped';
/**
 * Contract-package enrichment adds `partial` (some package lookups returned usable data, others
 * threw, returned none, or returned a CEP-18 token without symbol or decimals).
 * `absent` is no longer produced: a valid domain always carries `contract_package_hash`.
 */
export type EIP712ContractEnrichmentStatus = EIP712EnrichmentStatus | 'absent' | 'partial';

export interface IEIP712Enrichment {
  /** Account-info batch: `ok` (batch succeeded) or `failed` (batch threw). */
  accounts: EIP712EnrichmentStatus;
  /**
   * Contract package: `ok` (every lookup returned data, and every CEP-18 token has symbol and
   * decimals), `partial` (some lookups did), `failed` (none did: each threw or returned no data).
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
