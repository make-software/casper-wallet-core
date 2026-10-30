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

/**
 * Resolves the domain types for `domain` from `CASPER_DOMAIN_TYPES`. A caller-supplied schema
 * (`types.EIP712Domain` or `domainTypesOption`) must equal that set, in that order.
 * @throws EIP712Error `DOMAIN_TYPES_REQUIRED` on a non-Casper domain field or a differing schema.
 */
export function resolveDomainTypes(
  domain: Record<string, unknown>,
  types: IEIP712Types,
  domainTypesOption?: IEIP712Field[],
): IEIP712Field[] {
  const casperFieldNames = new Set(CASPER_DOMAIN_TYPES.map(f => f.name));
  for (const key of Object.keys(domain)) {
    if (!casperFieldNames.has(key)) {
      throw new EIP712Error(
        new Error(`Domain field "${key}" is not in CASPER_DOMAIN_TYPES.`),
        'resolveDomainTypes',
        SignTypedDataErrorCodes.DOMAIN_TYPES_REQUIRED,
      );
    }
  }

  const resolved = CASPER_DOMAIN_TYPES.filter(f => domain[f.name] != null);
  for (const [source, supplied] of [
    ['types.EIP712Domain', types.EIP712Domain],
    ['options.domainTypes', domainTypesOption],
  ] as const) {
    if (supplied && !isSameFieldList(supplied, resolved)) {
      throw new EIP712Error(
        new Error(`${source} does not match the Casper domain types for this domain.`),
        'resolveDomainTypes',
        SignTypedDataErrorCodes.DOMAIN_TYPES_REQUIRED,
      );
    }
  }

  return resolved;
}

function isSameFieldList(a: IEIP712Field[], b: IEIP712Field[]): boolean {
  return a.length === b.length && a.every((f, i) => f.name === b[i].name && f.type === b[i].type);
}

/**
 * Rejects unsupported field types: arrays, `bytes1`..`bytes31`, and struct references (a field
 * whose type is another entry of `types`).
 * @throws EIP712Error `UNSUPPORTED_TYPE`.
 */
export function validateTypedDataEIP712FieldTypes(types: IEIP712Types): void {
  for (const [typeName, fields] of Object.entries(types)) {
    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(types, field.type)) {
        throw new EIP712Error(
          new Error(`Struct types are not supported: "${field.type}" in ${typeName}.${field.name}`),
          'validateTypedDataEIP712',
          SignTypedDataErrorCodes.UNSUPPORTED_TYPE,
        );
      }
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
