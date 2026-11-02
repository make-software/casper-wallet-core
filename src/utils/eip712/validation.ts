import { CASPER_DOMAIN_TYPES } from '@casper-ecosystem/casper-eip-712';
import {
  CasperNetwork,
  casperChainNameToCasperNetwork,
  EIP712Error,
  IEIP712Field,
  IEIP712SignTypedDataOptions,
  IEIP712TypedData,
  IEIP712Types,
  SignTypedDataErrorCodes,
} from '../../domain';
import { IEIP712NumberType, parseEip712Number, parseNumberType } from './numbers';

const ARRAY_PATTERN = /\[/; // matches any array syntax: [], [N]
const BYTES_1_TO_31_PATTERN = /^bytes([1-9]|[12][0-9]|3[01])$/;
const STRICT_HEX_PATTERN = /^(?:0x)?(?:[0-9a-fA-F]{2})*$/;
const PRIMITIVE_TYPES = new Set(['address', 'bool', 'bytes', 'bytes32', 'string']);
const CAIP_2_CASPER_PREFIX = 'casper:';

function isSupportedFieldType(type: string): boolean {
  return PRIMITIVE_TYPES.has(type) || parseNumberType(type) !== null;
}

function hexByteLength(value: string): number {
  return (value.startsWith('0x') ? value.length - 2 : value.length) / 2;
}

function invalidValue(owner: string, name: string, reason: string): EIP712Error {
  return new EIP712Error(
    new Error(`Invalid value for ${owner}.${name}: ${reason}`),
    'validateTypedDataEIP712',
    SignTypedDataErrorCodes.INVALID_PARAMS,
  );
}

function validateNumber(
  owner: string,
  name: string,
  numberType: IEIP712NumberType,
  value: unknown,
): void {
  const n = parseEip712Number(value);
  if (n === null) {
    throw invalidValue(
      owner,
      name,
      'expected a bigint, a safe integer, a decimal string, an even-length 0x hex string or a 64-character hex word',
    );
  }
  const { unsigned, bits } = numberType;
  const max = (BigInt(1) << BigInt(unsigned ? bits : bits - 1)) - BigInt(1);
  if (n < BigInt(0) || n > max) {
    throw invalidValue(owner, name, `out of range for ${unsigned ? 'u' : ''}int${bits}`);
  }
}

function validateHex(owner: string, name: string, value: unknown, byteLengths?: number[]): void {
  if (typeof value !== 'string' || !STRICT_HEX_PATTERN.test(value)) {
    throw invalidValue(owner, name, 'expected an even-length hex string');
  }
  if (byteLengths && !byteLengths.includes(hexByteLength(value))) {
    throw invalidValue(owner, name, `expected ${byteLengths.join(' or ')} bytes`);
  }
}

/**
 * Checks each declared field's value against what the encoder will hash, so the display can
 * show the same meaning. `owner` names the struct in error messages.
 * @throws EIP712Error `INVALID_PARAMS` on a missing, mistyped, malformed or out-of-range value.
 */
export function validateTypedDataEIP712Values(
  owner: string,
  fields: IEIP712Field[],
  values: Record<string, unknown>,
): void {
  for (const { name, type } of fields) {
    const value = values[name];
    if (value === undefined || value === null) {
      throw invalidValue(owner, name, 'missing');
    }
    const numberType = parseNumberType(type);
    if (numberType) {
      validateNumber(owner, name, numberType, value);
    } else if (type === 'address') {
      validateHex(owner, name, value, [20, 33]);
    } else if (type === 'bytes32') {
      validateHex(owner, name, value, [32]);
    } else if (type === 'bytes') {
      validateHex(owner, name, value);
    } else if (type === 'bool') {
      if (typeof value !== 'boolean') throw invalidValue(owner, name, 'expected a boolean');
    } else if (type === 'string') {
      if (typeof value !== 'string') throw invalidValue(owner, name, 'expected a string');
    }
  }
}

/**
 * Returns the network `domain.chain_name` names. Accepts exactly a Casper chain name (`casper`,
 * `casper-test`, `dev-net`, `integration-test`) or its CAIP-2 form `casper:<chain name>`.
 * @throws EIP712Error `INVALID_PARAMS` on anything else.
 */
export function resolveTypedDataEIP712Network(domain: Record<string, unknown>): CasperNetwork {
  const chainName = domain.chain_name;
  const reference =
    typeof chainName === 'string' && chainName.startsWith(CAIP_2_CASPER_PREFIX)
      ? chainName.slice(CAIP_2_CASPER_PREFIX.length)
      : chainName;
  if (
    typeof reference !== 'string' ||
    !Object.prototype.hasOwnProperty.call(casperChainNameToCasperNetwork, reference)
  ) {
    throw invalidValue(
      'EIP712Domain',
      'chain_name',
      'expected the chain name of a known Casper network',
    );
  }
  return (casperChainNameToCasperNetwork as Record<string, CasperNetwork>)[reference];
}

/**
 * Requires the full Casper domain, the shape reference verifiers hash with `CasperDomainTypes`:
 * every field of `CASPER_DOMAIN_TYPES` present and non-null, and a `chain_name` that
 * `resolveTypedDataEIP712Network` accepts.
 * @throws EIP712Error `INVALID_PARAMS`.
 */
export function validateTypedDataEIP712Domain(domain: Record<string, unknown>): void {
  for (const { name } of CASPER_DOMAIN_TYPES) {
    if (domain[name] === undefined || domain[name] === null) {
      throw invalidValue('EIP712Domain', name, 'missing');
    }
  }
  resolveTypedDataEIP712Network(domain);
}

export function validatePrimaryType(types: IEIP712Types, primaryType: string): void {
  if (
    !Object.prototype.hasOwnProperty.call(types, primaryType) ||
    !Array.isArray(types[primaryType])
  ) {
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
 * Rejects arrays, `bytes1`..`bytes31`, struct references and any type outside `address`, `bool`,
 * `bytes`, `bytes32`, `string`, `uintN`, `intN`.
 * @throws EIP712Error `UNSUPPORTED_TYPE`, or `INVALID_PARAMS` for a field name declared twice.
 */
export function validateTypedDataEIP712FieldTypes(types: IEIP712Types): void {
  for (const [typeName, fields] of Object.entries(types)) {
    const seen = new Set<string>();
    for (const field of fields) {
      if (seen.has(field.name)) {
        throw new EIP712Error(
          new Error(`Field "${field.name}" is declared more than once in ${typeName}`),
          'validateTypedDataEIP712',
          SignTypedDataErrorCodes.INVALID_PARAMS,
        );
      }
      seen.add(field.name);
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
      if (!isSupportedFieldType(field.type)) {
        throw new EIP712Error(
          new Error(`Unsupported type: "${field.type}" in ${typeName}.${field.name}`),
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

/**
 * Runs every typed-data check in the order the digest needs them and returns the resolved
 * domain types. Both the digest and the display model are built only after this passes.
 * @throws EIP712Error with the code of the first failing check.
 */
export function validateTypedDataEIP712(
  typedData: IEIP712TypedData,
  options: Pick<IEIP712SignTypedDataOptions, 'domainTypes' | 'rejectUnknownFields'> = {},
): IEIP712Field[] {
  const { domain, types, primaryType, message } = typedData;
  for (const [name, part] of Object.entries({ domain, types, message })) {
    if (typeof part !== 'object' || part === null) {
      throw new EIP712Error(
        new Error(`typedData.${name} must be an object`),
        'validateTypedDataEIP712',
        SignTypedDataErrorCodes.INVALID_PARAMS,
      );
    }
  }
  validatePrimaryType(types, primaryType);
  validateTypedDataEIP712Domain(domain);
  const resolvedDomainTypes = resolveDomainTypes(domain, types, options.domainTypes);
  validateTypedDataEIP712FieldTypes(types);
  validateTypedDataEIP712Values('EIP712Domain', resolvedDomainTypes, domain);
  validateTypedDataEIP712Values(primaryType, types[primaryType], message);
  if (options.rejectUnknownFields) {
    validateNoUnknownMessageFields(types, primaryType, message);
  }
  return resolvedDomainTypes;
}
