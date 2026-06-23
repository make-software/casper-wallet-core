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
} from '../../domain';
import { Maybe } from '../../typings';

const BYTES_TYPE_REGEX = /^bytes(?:[1-9]|[12]\d|3[0-2])$/;
const NUMBER_TYPE_REGEX = /^u?int\d*$/;

const DATE_FIELD_NAMES = new Set([
  'validafter',
  'validbefore',
  'validuntil',
  'deadline',
  'expiry',
  'expiration',
]);

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

function isDateField(name: string, type: string): boolean {
  return DATE_FIELD_NAMES.has(name.toLowerCase()) && NUMBER_TYPE_REGEX.test(type);
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

export function keyToLabel(key: string): string {
  switch (key) {
    case 'contract_package_hash':
      return 'Package Hash';
    default:
      return key
        .replace(/([a-z])([A-Z])/g, '$1 $2') // split camelCase: validAfter → valid After
        .replace(/_/g, ' ')
        .replace(/\b\w/g, match => match.toUpperCase());
  }
}

/**
 * @internal
 * Optional enrichment for display rows. `utils` stays free of `data`-layer imports: the data layer
 * passes a closure (over `getAccountInfoFromMap`) and the already-fetched contract package.
 */
export interface IEIP712DisplayEnrichment {
  resolveAccountInfo?: (rawValue: string) => Maybe<IAccountInfo>;
  contractPackage?: Maybe<IContractPackage>;
}

function toRow(
  key: string,
  type: string,
  value: string,
  enrichment: IEIP712DisplayEnrichment,
  section: 'domain' | 'message',
): IEIP712DisplayRow {
  // The domain `contract_package_hash` is semantically always a hash. Some payloads omit it from
  // `types.EIP712Domain` (so `type` is '') or send it as `string`, which would otherwise classify it
  // as 'string' and leave the value un-shortened and non-copyable. Force hash presentation by key.
  const isContractPackageHash = section === 'domain' && key === 'contract_package_hash';
  const formattedDate = isDateField(key, type) ? formatEip712Date(value) : null;
  const presentation: EIP712FieldPresentation = isContractPackageHash
    ? 'hash'
    : formattedDate
      ? 'date'
      : getPresentationForType(type);
  const isHashLike = presentation === 'hash' || presentation === 'account';

  const accountInfo =
    presentation === 'account' && enrichment.resolveAccountInfo
      ? enrichment.resolveAccountInfo(value)
      : null;
  const contractPackage =
    section === 'domain' && key === 'contract_package_hash'
      ? (enrichment.contractPackage ?? null)
      : null;

  return {
    label: keyToLabel(key),
    value,
    displayValue:
      presentation === 'date' ? formattedDate! : isHashLike ? formatAddress(value, 'short') : value,
    presentation,
    type,
    copyValue: isHashLike ? value : null,
    accountInfo,
    contractPackage,
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
      toRow(key, getTypeForField(key, types, 'EIP712Domain'), String(val), enrichment, 'domain'),
    );

  const messageFields = types[primaryType] ?? [];
  const messageRows = messageFields.map(field =>
    toRow(field.name, field.type, String(message[field.name]), enrichment, 'message'),
  );

  return { domainRows, messageRows, primaryType };
}
