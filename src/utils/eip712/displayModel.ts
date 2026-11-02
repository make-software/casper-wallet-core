import { formatAddress } from '../address';
import { formatDeployDetailsTimestamp } from '../date';
import {
  EIP712FieldPresentation,
  IAccountInfo,
  IContractPackage,
  IEIP712DisplayModel,
  IEIP712DisplayRow,
  IEIP712TypedData,
  IEIP712Types,
  EIP712PathSegment,
} from '../../domain';
import { Maybe } from '../../typings';
import { decodeEip712Address } from './address';
import { parseEip712Number, parseNumberType } from './numbers';
import { getTypedDataEIP712Leaves, pathToLabel, pathToDepth } from './walk';

const BYTES_TYPE_REGEX = /^bytes(?:[1-9]|[12]\d|3[0-2])$/;
const NUMBER_TYPE_REGEX = /^u?int\d*$/;

// Lower-bound (valid-from) fields: 0 = valid since the epoch, u64::MAX = never reaches validity.
const LOWER_BOUND_DATE_FIELDS = new Set(['validafter']);
// Upper-bound (valid-until) fields: 0 = already expired, u64::MAX = no expiry.
const UPPER_BOUND_DATE_FIELDS = new Set(['validbefore', 'deadline', 'sigdeadline', 'expiration']);

/** Unix values at/above this are already milliseconds; below are seconds. */
const MS_THRESHOLD = 1e12;

/** Format an EIP-712 unix timestamp (seconds, or ms when >= 1e12). Null on non-positive/unparseable. */
export function formatEip712Date(value: string): Maybe<string> {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return null;
  }
  const ms = num >= MS_THRESHOLD ? num : num * 1000;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return formatDeployDetailsTimestamp(date.toISOString());
}

// BigInt() calls, not `n` literals: consumers compile this source under target es2017
// (e.g. casper-wallet), where BigInt literals are a TS2737 error.
const U64_MAX = BigInt('18446744073709551615');

/** `2^bits - 1` for a `uintN` type, else null. */
function unsignedTypeMax(type: string): Maybe<bigint> {
  const numberType = parseNumberType(type);
  if (!numberType || !numberType.unsigned) {
    return null;
  }
  return (BigInt(1) << BigInt(numberType.bits)) - BigInt(1);
}

const AMOUNT_FIELDS = new Set(['amount', 'value']);

/**
 * Friendly text for EIP-712 timestamp sentinels, else null. The label depends on the field's role:
 * the same 0 / u64::MAX value means the opposite for a lower bound (valid-from) vs an upper bound
 * (valid-until), so a shared mapping would mislabel one of them in a signing UI. A type maximum
 * counts as a sentinel only for `uintN` with N >= 48; narrower maxima are ordinary timestamps.
 */
function dateSentinelLabel(name: string, type: string, value: string): Maybe<string> {
  if (value.trim() === '') {
    return null;
  }
  let n: bigint;
  try {
    n = BigInt(value);
  } catch {
    return null;
  }
  const isLowerBound = LOWER_BOUND_DATE_FIELDS.has(name.toLowerCase());
  if (n === BigInt(0)) return isLowerBound ? 'Always' : 'Expired';
  const numberType = parseNumberType(type);
  const isWideTypeMax =
    !!numberType && numberType.unsigned && numberType.bits >= 48 && n === unsignedTypeMax(type);
  if (n >= U64_MAX || isWideTypeMax) return isLowerBound ? 'Never' : 'No expiry';
  return null;
}

function isDateField(name: string, type: string): boolean {
  const lower = name.toLowerCase();
  return (
    (LOWER_BOUND_DATE_FIELDS.has(lower) || UPPER_BOUND_DATE_FIELDS.has(lower)) &&
    NUMBER_TYPE_REGEX.test(type)
  );
}

export function getPresentationForType(type: string): EIP712FieldPresentation {
  if (type === 'address') {
    return 'account';
  }
  if (BYTES_TYPE_REGEX.test(type)) {
    return 'hash';
  }
  if (NUMBER_TYPE_REGEX.test(type)) {
    return 'number';
  }
  return 'string';
}

function getTypeForField(fieldName: string, types: IEIP712Types, typeName: string): string {
  const fields = types[typeName];
  if (!fields) {
    return '';
  }
  return fields.find(f => f.name === fieldName)?.type ?? '';
}

/**
 * @internal
 * Optional enrichment for display rows. `utils` stays free of `data`-layer imports: the data layer
 * passes closures keyed by the decoded hash (not the raw tagged value).
 */
export interface IEIP712DisplayEnrichment {
  resolveAccountInfo?: (accountHash: string) => Maybe<IAccountInfo>;
  resolveContractPackage?: (packageHash: string) => Maybe<IContractPackage>;
}

function toRow(
  path: EIP712PathSegment[],
  type: string,
  rawValue: string,
  enrichment: IEIP712DisplayEnrichment,
  section: 'domain' | 'message',
): IEIP712DisplayRow {
  const label = pathToLabel(path);
  const key = [...path]
    .reverse()
    .find((segment): segment is string => typeof segment === 'string')!;
  const depth = pathToDepth(path);
  const parsed = parseNumberType(type) ? parseEip712Number(rawValue) : null;
  const value = parsed === null ? rawValue : parsed.toString();

  // Domain contract_package_hash is a bytes32 (no Key tag) — always a package hash.
  if (section === 'domain' && key === 'contract_package_hash') {
    const packageHash = value.startsWith('0x') ? value.slice(2) : value;
    return {
      label,
      value: packageHash,
      displayValue: formatAddress(packageHash, 'short'),
      presentation: 'hash',
      type,
      copyValue: packageHash,
      accountInfo: null,
      contractPackage: enrichment.resolveContractPackage?.(packageHash) ?? null,
      path,
      depth,
      token: null,
    };
  }

  // address fields are Casper Keys: 0x00 = account, 0x01 = package.
  if (type === 'address') {
    const { kind, hash } = decodeEip712Address(value);
    if (kind === 'account' && hash) {
      return {
        label,
        value: hash,
        displayValue: formatAddress(hash, 'short'),
        presentation: 'account',
        type,
        copyValue: hash,
        accountInfo: enrichment.resolveAccountInfo?.(hash) ?? null,
        contractPackage: null,
        path,
        depth,
        token: null,
      };
    }
    if (kind === 'package' && hash) {
      return {
        label,
        value: hash,
        displayValue: formatAddress(hash, 'short'),
        presentation: 'hash',
        type,
        copyValue: hash,
        accountInfo: null,
        contractPackage: enrichment.resolveContractPackage?.(hash) ?? null,
        path,
        depth,
        token: null,
      };
    }
    return {
      label,
      value,
      displayValue: formatAddress(value, 'short'),
      presentation: 'hash',
      type,
      copyValue: value,
      accountInfo: null,
      contractPackage: null,
      path,
      depth,
      token: null,
    };
  }

  // Known timestamp fields -> date (with sentinels), else fall through.
  if (isDateField(key, type)) {
    const formatted = dateSentinelLabel(key, type, value) ?? formatEip712Date(value);
    if (formatted) {
      return {
        label,
        value,
        displayValue: formatted,
        presentation: 'date',
        type,
        copyValue: null,
        accountInfo: null,
        contractPackage: null,
        path,
        depth,
        token: null,
      };
    }
  }

  if (AMOUNT_FIELDS.has(key) && parsed !== null && parsed === unsignedTypeMax(type)) {
    return {
      label,
      value,
      displayValue: 'Unlimited',
      presentation: 'number',
      type,
      copyValue: null,
      accountInfo: null,
      contractPackage: null,
      path,
      depth,
      token: null,
    };
  }

  const presentation = getPresentationForType(type);
  const isHashLike = presentation === 'hash' || presentation === 'account';
  return {
    label,
    value,
    displayValue: isHashLike ? formatAddress(value, 'short') : value,
    presentation,
    type,
    copyValue: isHashLike ? value : null,
    accountInfo: null,
    contractPackage: null,
    path,
    depth,
    token: null,
  };
}

function emptyArrayRow(path: EIP712PathSegment[], type: string): IEIP712DisplayRow {
  return {
    label: pathToLabel(path),
    value: '',
    displayValue: 'None',
    presentation: 'string',
    type,
    copyValue: null,
    accountInfo: null,
    contractPackage: null,
    path,
    depth: pathToDepth(path),
    token: null,
  };
}

export function buildTypedDataEIP712DisplayModel(
  typedData: IEIP712TypedData,
  enrichment: IEIP712DisplayEnrichment = {},
  excludeDomainKeys: readonly string[] = [],
): IEIP712DisplayModel {
  const { domain, types, primaryType, message } = typedData;
  const exclude = new Set(excludeDomainKeys);

  const domainRows = Object.entries(domain)
    .filter(([key]) => !exclude.has(key))
    .map(([key, val]) =>
      toRow([key], getTypeForField(key, types, 'EIP712Domain'), String(val), enrichment, 'domain'),
    );

  const messageRows = getTypedDataEIP712Leaves(primaryType, types, message).map(leaf =>
    Array.isArray(leaf.value) && leaf.value.length === 0
      ? emptyArrayRow(leaf.path, leaf.type)
      : toRow(leaf.path, leaf.type, String(leaf.value), enrichment, 'message'),
  );

  return { domainRows, messageRows, primaryType };
}
