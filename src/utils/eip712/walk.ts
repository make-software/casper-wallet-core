import { EIP712PathSegment, IEIP712Field, IEIP712Types } from '../../domain';
import { isEip712StructType, parseEip712FieldType } from './types';

export interface IEIP712Leaf {
  path: EIP712PathSegment[];
  /** Leaf type: a primitive, or the array type itself for an empty array. */
  type: string;
  value: unknown;
  /** Field list of the struct directly holding this leaf, and its value, for sibling lookups. */
  parentFields: IEIP712Field[];
  parentValue: Record<string, unknown>;
}

/** Leaves of `value` (struct `typeName`) in declaration order, depth-first. `value` must be validated. */
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
  ) => {
    const parentFields = types[structName];
    for (const { name, type } of parentFields) {
      const fieldValue = struct[name];
      const parsed = parseEip712FieldType(type);
      const base = parsed?.base ?? type;
      const path = [...prefix, name];

      const visitElement = (element: unknown, elementPath: EIP712PathSegment[]) => {
        if (isEip712StructType(types, base)) {
          visitStruct(base, element as Record<string, unknown>, elementPath);
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
      const elements = fieldValue as unknown[];
      if (elements.length === 0) {
        leaves.push({ path, type, value: elements, parentFields, parentValue: struct });
        continue;
      }
      elements.forEach((element, i) => visitElement(element, [...path, i]));
    }
  };

  visitStruct(typeName, value, []);
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
