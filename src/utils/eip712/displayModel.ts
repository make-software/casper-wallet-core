import { formatAddress } from '../address';
import {
  IEIP712DisplayModel,
  IEIP712DisplayRow,
  IEIP712TypedData,
  IEIP712Types,
} from '../../domain';

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
      return key.replace(/_/g, ' ').replace(/\b\w/g, match => match.toUpperCase());
  }
}

function toRow(key: string, type: string, value: string, isAddress: boolean): IEIP712DisplayRow {
  return {
    label: keyToLabel(key),
    value,
    displayValue: isAddress ? formatAddress(value, 'short') : value,
    isAddress,
    copyValue: isAddress ? value : null,
    type,
  };
}

export function buildTypedDataDisplayModel(typedData: IEIP712TypedData): IEIP712DisplayModel {
  const { domain, types, primaryType, message } = typedData;

  const domainRows = Object.entries(domain).map(([key, val]) => {
    const type = getTypeForField(key, types, 'EIP712Domain');
    // Domain asymmetry: address rows are `address` OR the contract_package_hash key only.
    const isAddress = type === 'address' || key === 'contract_package_hash';
    return toRow(key, type, String(val), isAddress);
  });

  const messageFields = types[primaryType] ?? [];
  const messageRows = messageFields.map(field => {
    // Message asymmetry: address rows are `address` OR `bytes32`.
    const isAddress = field.type === 'address' || field.type === 'bytes32';
    return toRow(field.name, field.type, String(message[field.name]), isAddress);
  });

  return { domainRows, messageRows, primaryType };
}
