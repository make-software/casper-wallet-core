import { IEIP712Types } from '../../domain';

export const MAX_EIP712_STRUCT_DEPTH = 4;
export const MAX_EIP712_ARRAY_LENGTH = 64;

const FIELD_TYPE_PATTERN = /^([A-Za-z_$][\w$]*)(?:\[([1-9]\d*)?\])?$/;

/** A parsed field type: `base` without the array suffix; `arrayLength` is null for `T[]`. */
export interface IEIP712ParsedType {
  base: string;
  isArray: boolean;
  arrayLength: number | null;
}

/** Parses `T`, `T[]` or `T[N]` (N in 1..64, no leading zero). Null for anything else, including `T[][]`. */
export function parseEip712FieldType(type: string): IEIP712ParsedType | null {
  const match = FIELD_TYPE_PATTERN.exec(type);
  if (!match) {
    return null;
  }
  const arrayLength = match[2] === undefined ? null : Number(match[2]);
  if (arrayLength !== null && arrayLength > MAX_EIP712_ARRAY_LENGTH) {
    return null;
  }
  return { base: match[1], isArray: type.endsWith(']'), arrayLength };
}

/** True when `base` names a struct in `types` (own property), never for a primitive name. */
export function isEip712StructType(types: IEIP712Types, base: string): boolean {
  return Object.prototype.hasOwnProperty.call(types, base) && Array.isArray(types[base]);
}
