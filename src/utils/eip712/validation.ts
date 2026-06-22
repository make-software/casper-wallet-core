import { CASPER_DOMAIN_TYPES } from '@casper-ecosystem/casper-eip-712';
import { EIP712Error, IEIP712Field, IEIP712Types, SignTypedDataErrorCodes } from '../../domain';

const ARRAY_PATTERN = /\[/; // matches any array syntax: [], [N]
const BYTES_1_TO_31_PATTERN = /^bytes([1-9]|[12][0-9]|3[01])$/;

export function validatePrimaryType(types: IEIP712Types, primaryType: string): void {
  if (!types[primaryType]) {
    throw new EIP712Error(
      new Error(`Primary type "${primaryType}" not found in type definitions`),
      'validateTypedDataEIP712',
      SignTypedDataErrorCodes.INVALID_PARAMS,
    );
  }
}

export function resolveDomainTypes(
  domain: Record<string, unknown>,
  types: IEIP712Types,
  domainTypesOption?: IEIP712Field[],
): IEIP712Field[] {
  if (types.EIP712Domain) {
    return types.EIP712Domain;
  }
  if (domainTypesOption) {
    return domainTypesOption;
  }

  const casperFieldNames = new Set(CASPER_DOMAIN_TYPES.map(f => f.name));
  for (const key of Object.keys(domain)) {
    if (!casperFieldNames.has(key)) {
      throw new EIP712Error(
        new Error(
          `Domain field "${key}" is not in CASPER_DOMAIN_TYPES. Provide options.domainTypes or include EIP712Domain in types.`,
        ),
        'resolveDomainTypes',
        SignTypedDataErrorCodes.DOMAIN_TYPES_REQUIRED,
      );
    }
  }

  return CASPER_DOMAIN_TYPES.filter(f => domain[f.name] != null);
}

export function validateTypedDataEIP712FieldTypes(types: IEIP712Types): void {
  for (const [typeName, fields] of Object.entries(types)) {
    for (const field of fields) {
      if (ARRAY_PATTERN.test(field.type)) {
        throw new EIP712Error(
          new Error(`Array types are not supported: "${field.type}" in ${typeName}.${field.name}`),
          'validateTypedDataEIP712',
          SignTypedDataErrorCodes.UNSUPPORTED_TYPE,
        );
      }
      if (BYTES_1_TO_31_PATTERN.test(field.type)) {
        throw new EIP712Error(
          new Error(
            `bytes1..bytes31 types are not supported: "${field.type}" in ${typeName}.${field.name}`,
          ),
          'validateTypedDataEIP712',
          SignTypedDataErrorCodes.UNSUPPORTED_TYPE,
        );
      }
    }
  }
}

export function validateNoUnknownMessageFields(
  types: IEIP712Types,
  primaryType: string,
  message: Record<string, unknown>,
): void {
  const knownFields = new Set(types[primaryType].map(f => f.name));
  for (const key of Object.keys(message)) {
    if (!knownFields.has(key)) {
      throw new EIP712Error(
        new Error(`Unknown field "${key}" in message not defined in type "${primaryType}"`),
        'validateTypedDataEIP712',
        SignTypedDataErrorCodes.INVALID_PARAMS,
      );
    }
  }
}
