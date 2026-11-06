import { EIP712PathSegment, IEIP712Field, IEIP712Types } from '../../domain';
import { MAX_EIP712_STRUCT_DEPTH, isEip712StructType, parseEip712FieldType } from './types';

export interface IEIP712Leaf {
  path: EIP712PathSegment[];
  /** Leaf type: a primitive, or the declared type of an empty array or a wrong-shaped value. */
  type: string;
  value: unknown;
  /** Field list of the struct directly holding this leaf, and its value, for sibling lookups. */
  parentFields: IEIP712Field[];
  parentValue: Record<string, unknown>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Leaves of `value` (struct `typeName`) in declaration order, depth-first. Never throws: on
 * unvalidated input a struct or array value of the wrong shape, or one nested deeper than
 * `MAX_EIP712_STRUCT_DEPTH`, is itself a leaf of its declared type.
 */
export function getTypedDataEIP712Leaves(
  typeName: string,
  types: IEIP712Types,
  value: Record<string, unknown>,
): IEIP712Leaf[] {
  const leaves: IEIP712Leaf[] = [];

  const visitStruct = (
    structName: string,
    struct: Record<string, unknown>,
    prefix: EIP712PathSegment[],
    depth: number,
  ) => {
    const parentFields = Array.isArray(types[structName]) ? types[structName] : [];
    for (const { name, type } of parentFields) {
      const fieldValue = struct[name];
      const parsed = parseEip712FieldType(type);
      const base = parsed?.base ?? type;
      const path = [...prefix, name];

      const visitElement = (element: unknown, elementPath: EIP712PathSegment[]) => {
        if (
          isEip712StructType(types, base) &&
          isPlainObject(element) &&
          depth < MAX_EIP712_STRUCT_DEPTH
        ) {
          visitStruct(base, element, elementPath, depth + 1);
        } else {
          leaves.push({
            path: elementPath,
            type: base,
            value: element,
            parentFields,
            parentValue: struct,
          });
        }
      };

      if (!parsed?.isArray) {
        visitElement(fieldValue, path);
        continue;
      }
      if (!Array.isArray(fieldValue) || fieldValue.length === 0) {
        leaves.push({ path, type, value: fieldValue, parentFields, parentValue: struct });
        continue;
      }
      fieldValue.forEach((element, i) => visitElement(element, [...path, i]));
    }
  };

  if (isPlainObject(value)) {
    visitStruct(typeName, value, [], 0);
  }
  return leaves;
}

/** `['permitted', 0, 'token']` → `'Permitted #1 › Token'`. */
export function pathToLabel(path: EIP712PathSegment[]): string {
  const labels: string[] = [];
  for (const segment of path) {
    if (typeof segment === 'number') {
      labels[labels.length - 1] += ` #${segment + 1}`;
    } else {
      labels.push(keyToLabel(segment));
    }
  }
  return labels.join(' › ');
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

/** Struct nesting of a path: string segments minus one; array indexes do not count. */
export function pathToDepth(path: EIP712PathSegment[]): number {
  return path.filter(segment => typeof segment === 'string').length - 1;
}
