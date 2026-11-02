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
import {
  MAX_EIP712_ARRAY_LENGTH,
  MAX_EIP712_MESSAGE_ROWS,
  MAX_EIP712_STRUCT_DEPTH,
  isEip712StructType,
  parseEip712FieldType,
} from './types';

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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates `value` as struct `typeName` at every depth; `path` prefixes error messages.
 * Returns the number of leaf rows the value displays as (an empty array counts as one).
 * @throws EIP712Error `INVALID_PARAMS`.
 */
export function validateTypedDataEIP712Struct(
  typeName: string,
  types: IEIP712Types,
  value: unknown,
  path: string,
  rejectUnknownFields = false,
): number {
  if (!isPlainObject(value)) {
    throw new EIP712Error(
      new Error(`Invalid value for ${path}: expected an object`),
      'validateTypedDataEIP712',
      SignTypedDataErrorCodes.INVALID_PARAMS,
    );
  }
  const fields = types[typeName];
  if (rejectUnknownFields) {
    const known = new Set(fields.map(f => f.name));
    for (const key of Object.keys(value)) {
      if (!known.has(key)) {
        const where = path === typeName ? 'message' : path;
        throw new EIP712Error(
          new Error(`Unknown field "${key}" in ${where} not defined in type "${typeName}"`),
          'validateTypedDataEIP712',
          SignTypedDataErrorCodes.INVALID_PARAMS,
        );
      }
    }
  }
  let rows = 0;
  for (const field of fields) {
    const { name, type } = field;
    const fieldValue = value[name];
    if (fieldValue === undefined || fieldValue === null) {
      throw invalidValue(path, name, 'missing');
    }
    const parsed = parseEip712FieldType(type);
    if (!parsed) {
      throw invalidValue(path, name, `unsupported type "${type}"`);
    }
    const walk = (element: unknown, elementPath: string): number => {
      if (isEip712StructType(types, parsed.base)) {
        return validateTypedDataEIP712Struct(
          parsed.base,
          types,
          element,
          elementPath,
          rejectUnknownFields,
        );
      }
      validateTypedDataEIP712Values(
        path,
        [{ name: elementPath.slice(path.length + 1), type: parsed.base }],
        { [elementPath.slice(path.length + 1)]: element },
      );
      return 1;
    };
    if (!parsed.isArray) {
      rows += walk(fieldValue, `${path}.${name}`);
      continue;
    }
    if (!Array.isArray(fieldValue)) {
      throw invalidValue(path, name, 'expected an array');
    }
    if (fieldValue.length > MAX_EIP712_ARRAY_LENGTH) {
      throw invalidValue(path, name, `array longer than ${MAX_EIP712_ARRAY_LENGTH} entries`);
    }
    if (parsed.arrayLength !== null && fieldValue.length !== parsed.arrayLength) {
      throw invalidValue(path, name, `expected exactly ${parsed.arrayLength} entries`);
    }
    if (fieldValue.length === 0) {
      rows += 1;
    }
    fieldValue.forEach((element, i) => {
      rows += walk(element, `${path}.${name}[${i}]`);
    });
    if (rows > MAX_EIP712_MESSAGE_ROWS) {
      throw invalidValue(path, name, `more than ${MAX_EIP712_MESSAGE_ROWS} displayed rows`);
    }
  }
  return rows;
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
 * Accepts struct references and one-dimensional arrays (`T[]`, `T[N]`, N in 1..64) of
 * `address`, `bool`, `bytes`, `bytes32`, `string`, `uintN`, `intN` or a struct. Rejects
 * multi-dimensional arrays, `bytes1`..`bytes31`, undefined structs, cycles and, when `primaryType`
 * is given, struct nesting deeper than 4 levels below it.
 * @throws EIP712Error `UNSUPPORTED_TYPE`, or `INVALID_PARAMS` for a field name declared twice or a
 * struct named like a primitive.
 */
export function validateTypedDataEIP712FieldTypes(types: IEIP712Types, primaryType?: string): void {
  for (const typeName of Object.keys(types)) {
    if (isSupportedFieldType(typeName) || BYTES_1_TO_31_PATTERN.test(typeName)) {
      throw new EIP712Error(
        new Error(`Type name "${typeName}" shadows a primitive type`),
        'validateTypedDataEIP712',
        SignTypedDataErrorCodes.INVALID_PARAMS,
      );
    }
  }
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
      const unsupported = (reason: string) =>
        new EIP712Error(
          new Error(`${reason}: "${field.type}" in ${typeName}.${field.name}`),
          'validateTypedDataEIP712',
          SignTypedDataErrorCodes.UNSUPPORTED_TYPE,
        );
      const parsed = parseEip712FieldType(field.type);
      if (!parsed) {
        throw unsupported('Unsupported type');
      }
      if (parsed.base === 'EIP712Domain') {
        throw unsupported('EIP712Domain cannot be used as a field type');
      }
      if (isEip712StructType(types, parsed.base)) {
        continue;
      }
      if (BYTES_1_TO_31_PATTERN.test(parsed.base)) {
        throw unsupported('bytes1..bytes31 types are not supported');
      }
      if (!isSupportedFieldType(parsed.base)) {
        throw unsupported('Unsupported type');
      }
    }
  }
  if (primaryType !== undefined) {
    validateStructGraph(types, primaryType);
  }
}

function validateStructGraph(types: IEIP712Types, primaryType: string): void {
  const visiting = new Set<string>();
  const visit = (typeName: string, depth: number): void => {
    visiting.add(typeName);
    for (const field of types[typeName]) {
      const base = parseEip712FieldType(field.type)?.base;
      if (base === undefined || !isEip712StructType(types, base)) {
        continue;
      }
      const fail = (reason: string) =>
        new EIP712Error(
          new Error(`${reason}: "${field.type}" in ${typeName}.${field.name}`),
          'validateTypedDataEIP712',
          SignTypedDataErrorCodes.UNSUPPORTED_TYPE,
        );
      if (visiting.has(base)) {
        throw fail('Recursive type');
      }
      if (depth + 1 > MAX_EIP712_STRUCT_DEPTH) {
        throw fail(`Struct nesting deeper than ${MAX_EIP712_STRUCT_DEPTH} levels`);
      }
      visit(base, depth + 1);
    }
    visiting.delete(typeName);
  };
  if (isEip712StructType(types, primaryType)) {
    visit(primaryType, 0);
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
  validateTypedDataEIP712FieldTypes(types, primaryType);
  validateTypedDataEIP712Values('EIP712Domain', resolvedDomainTypes, domain);
  const rows = validateTypedDataEIP712Struct(
    primaryType,
    types,
    message,
    primaryType,
    options.rejectUnknownFields,
  );
  if (rows > MAX_EIP712_MESSAGE_ROWS) {
    throw new EIP712Error(
      new Error(`Message displays ${rows} rows, more than ${MAX_EIP712_MESSAGE_ROWS}`),
      'validateTypedDataEIP712',
      SignTypedDataErrorCodes.INVALID_PARAMS,
    );
  }
  return resolvedDomainTypes;
}
