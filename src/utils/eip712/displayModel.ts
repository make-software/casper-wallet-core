import { formatAddress } from '../address';
import { formatDeployDetailsTimestamp } from '../date';
import {
  EIP712FieldPresentation,
  IAccountInfo,
  IContractPackage,
  IEIP712DisplayModel,
  IEIP712DisplayRow,
  IEIP712Field,
  IEIP712RowToken,
  IEIP712TypedData,
  IEIP712Types,
  EIP712PathSegment,
} from '../../domain';
import { Maybe } from '../../typings';
import { shiftDecimal } from '../decimal';
import { decodeEip712Address, stripHexPrefix } from './address';
import { parseEip712Number, parseNumberType } from './numbers';
import { getTypedDataEIP712Leaves, pathToLabel, pathToDepth } from './walk';

const BYTES_TYPE_REGEX = /^bytes(?:[1-9]|[12]\d|3[0-2])$/;
const NUMBER_TYPE_REGEX = /^u?int\d*$/;

// Lower-bound (valid-from) fields: 0 = valid since the epoch, u64::MAX = never reaches validity.
const LOWER_BOUND_DATE_FIELDS = new Set(['validafter']);
// Upper-bound (valid-until) fields: see `dateSentinelLabel` for the 0 and maximum labels.
const UPPER_BOUND_DATE_FIELDS = new Set(['validbefore', 'deadline', 'sigdeadline', 'expiration']);

/** Unix values at/above this are already milliseconds; below are seconds. */
const MS_THRESHOLD = 1e12;

// Permit2 reads these as seconds, so the millisecond heuristic must not apply to them.
const SECONDS_ONLY_DATE_FIELDS: ReadonlySet<string> = new Set(['sigdeadline', 'expiration']);
const PERMIT2_TRANSFER_PRIMARY_TYPES = new Set([
  'PermitTransferFrom',
  'PermitBatchTransferFrom',
  'PermitWitnessTransferFrom',
  'PermitBatchWitnessTransferFrom',
]);
const PERMIT2_TRANSFER_SECONDS_ONLY_DATE_FIELDS: ReadonlySet<string> = new Set([
  ...SECONDS_ONLY_DATE_FIELDS,
  'deadline',
]);

/**
 * Format an EIP-712 unix timestamp: seconds, or ms when >= 1e12 unless `unit` is `'seconds'`.
 * Null on non-positive, unparseable or out-of-range input.
 */
export function formatEip712Date(value: string, unit: 'auto' | 'seconds' = 'auto'): Maybe<string> {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return null;
  }
  const ms = unit === 'auto' && num >= MS_THRESHOLD ? num : num * 1000;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return formatDeployDetailsTimestamp(date.toISOString());
}

// BigInt() calls, not `n` literals: consumers compile this source under target es2017
// (e.g. casper-wallet), where BigInt literals are a TS2737 error.
const U64_MAX = BigInt('18446744073709551615');

/** `2^bits - 1` for a `uintN` type of at least `minBits`, else null. */
function unsignedTypeMax(type: string, minBits = 8): Maybe<bigint> {
  const numberType = parseNumberType(type);
  if (!numberType || !numberType.unsigned || numberType.bits < minBits) {
    return null;
  }
  return (BigInt(1) << BigInt(numberType.bits)) - BigInt(1);
}

/** Narrower amount types at their maximum are real quantities, shown exactly. */
const UNLIMITED_MIN_BITS = 160;

const AMOUNT_FIELDS = new Set(['amount', 'value']);

/** Exact token amount: integer part grouped with `,`, full fraction without trailing zeros, then the symbol. */
export function formatEip712TokenAmount(raw: bigint, decimals: number, symbol: string): string {
  const [int, frac] = shiftDecimal(raw.toString(), -decimals).toFixed().split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${frac ? `${grouped}.${frac}` : grouped} ${symbol}`;
}

/**
 * Friendly text for EIP-712 timestamp sentinels, else null. 0 / u64::MAX mean opposite things for a
 * lower vs upper bound; `expiration` at 0 is "Current block only" (Permit2), other upper bounds
 * "Expired". A type maximum is a sentinel only for `uintN` with N >= 48.
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
  if (n === BigInt(0)) {
    if (isLowerBound) return 'Always';
    return name.toLowerCase() === 'expiration' ? 'Current block only' : 'Expired';
  }
  const isWideTypeMax = n === unsignedTypeMax(type, 48);
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
  resolveToken?: (packageHash: string) => Maybe<IEIP712RowToken>;
}

interface IMessageRowContext {
  secondsOnlyDateFields: ReadonlySet<string>;
  parentFields: IEIP712Field[];
  parentValue: Record<string, unknown>;
  primaryFields: IEIP712Field[];
  domainPackageHash: Maybe<string>;
}

function findAmountToken(
  ctx: IMessageRowContext,
  depth: number,
  enrichment: IEIP712DisplayEnrichment,
): Maybe<IEIP712RowToken> {
  if (!enrichment.resolveToken) {
    return null;
  }
  const tokenField = ctx.parentFields.find(f => f.name === 'token' && f.type === 'address');
  if (tokenField) {
    const { kind, hash } = decodeEip712Address(String(ctx.parentValue.token));
    return kind === 'package' && hash ? enrichment.resolveToken(hash) : null;
  }
  if (depth === 0 && !ctx.primaryFields.some(f => f.name === 'token') && ctx.domainPackageHash) {
    return enrichment.resolveToken(ctx.domainPackageHash);
  }
  return null;
}

function toRow(
  path: EIP712PathSegment[],
  type: string,
  rawValue: string,
  enrichment: IEIP712DisplayEnrichment,
  section: 'domain' | 'message',
  messageContext?: IMessageRowContext,
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
    const secondsOnly = messageContext?.secondsOnlyDateFields ?? SECONDS_ONLY_DATE_FIELDS;
    const unit = secondsOnly.has(key.toLowerCase()) ? 'seconds' : 'auto';
    const formatted = dateSentinelLabel(key, type, value) ?? formatEip712Date(value, unit);
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

  if (AMOUNT_FIELDS.has(key) && parsed !== null) {
    const token = messageContext ? findAmountToken(messageContext, depth, enrichment) : null;
    const isMax = parsed === unsignedTypeMax(type, UNLIMITED_MIN_BITS);
    if (token || isMax) {
      let displayValue = 'Unlimited';
      if (token) {
        displayValue = isMax
          ? `Unlimited ${token.symbol}`
          : formatEip712TokenAmount(parsed, token.decimals, token.symbol);
      }
      return {
        label,
        value,
        displayValue,
        presentation: 'amount',
        type,
        copyValue: null,
        accountInfo: null,
        contractPackage: null,
        path,
        depth,
        token,
      };
    }
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

  const rawDomainPackage = domain.contract_package_hash;
  const domainPackageHash =
    rawDomainPackage === undefined ? null : stripHexPrefix(String(rawDomainPackage));
  const primaryFields = types[primaryType] ?? [];
  const secondsOnlyDateFields = PERMIT2_TRANSFER_PRIMARY_TYPES.has(primaryType)
    ? PERMIT2_TRANSFER_SECONDS_ONLY_DATE_FIELDS
    : SECONDS_ONLY_DATE_FIELDS;

  const messageRows = getTypedDataEIP712Leaves(primaryType, types, message).map(leaf =>
    Array.isArray(leaf.value) && leaf.value.length === 0
      ? emptyArrayRow(leaf.path, leaf.type)
      : toRow(leaf.path, leaf.type, String(leaf.value), enrichment, 'message', {
          secondsOnlyDateFields,
          parentFields: leaf.parentFields,
          parentValue: leaf.parentValue,
          primaryFields,
          domainPackageHash,
        }),
  );

  return { domainRows, messageRows, primaryType };
}
