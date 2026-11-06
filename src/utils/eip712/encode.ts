import {
  buildCanonicalTypeString,
  computeTypeHash,
  encodeField,
  keccak256,
} from '@casper-ecosystem/casper-eip-712';
import { IEIP712Types } from '../../domain';
import { isEip712StructType, parseEip712FieldType } from './types';

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function encodeValue(type: string, types: IEIP712Types, value: unknown): Uint8Array {
  const parsed = parseEip712FieldType(type)!;
  if (parsed.isArray) {
    return keccak256(
      concatBytes((value as unknown[]).map(item => encodeValue(parsed.base, types, item))),
    );
  }
  if (isEip712StructType(types, parsed.base)) {
    return hashTypedDataEIP712Struct(parsed.base, types, value as Record<string, unknown>);
  }
  return encodeField(parsed.base, value);
}

/** `typeHash` and `encodeData` of struct `typeName`. `value` must be validated and normalised. */
export function encodeTypedDataEIP712Struct(
  typeName: string,
  types: IEIP712Types,
  value: Record<string, unknown>,
): { typeHash: Uint8Array; encodedData: Uint8Array } {
  const typeHash = computeTypeHash(buildCanonicalTypeString(typeName, types));
  const parts = types[typeName].map(({ name, type }) => encodeValue(type, types, value[name]));
  return { typeHash, encodedData: concatBytes(parts) };
}

/** EIP-712 `hashStruct` with nested structs and one-dimensional arrays. */
export function hashTypedDataEIP712Struct(
  typeName: string,
  types: IEIP712Types,
  value: Record<string, unknown>,
): Uint8Array {
  const { typeHash, encodedData } = encodeTypedDataEIP712Struct(typeName, types, value);
  return keccak256(concatBytes([typeHash, encodedData]));
}
