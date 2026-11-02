import { IEIP712Field } from '../../domain';

const NUMBER_TYPE_PATTERN = /^(u?)int(\d*)$/;
const DECIMAL_PATTERN = /^\d+$/;
const HEX_WORD_PATTERN = /^[0-9a-fA-F]{64}$/;
const HEX_PATTERN = /^0x(?:[0-9a-fA-F]{2}){1,32}$/;

export interface IEIP712NumberType {
  unsigned: boolean;
  bits: number;
}

/** `uintN` / `intN` with N a multiple of 8 in 8..256, or bare `uint` / `int` (256). Null otherwise. */
export function parseNumberType(type: string): IEIP712NumberType | null {
  const match = NUMBER_TYPE_PATTERN.exec(type);
  if (!match) {
    return null;
  }
  const bits = match[2] === '' ? 256 : Number(match[2]);
  if (bits % 8 !== 0 || bits < 8 || bits > 256) {
    return null;
  }
  return { unsigned: match[1] === 'u', bits };
}

/**
 * Returns the bigint a numeric value denotes, or null when the value has no single meaning
 * across the reference implementations. Accepts bigint, a safe integer, a digit-only decimal
 * string, a `0x` hex string of 2..64 digits in pairs and a 64-character hex word without `0x`
 * (a 64-digit word not starting with `0` is ambiguous with decimal and rejected). No range check.
 */
export function parseEip712Number(value: unknown): bigint | null {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) ? BigInt(value) : null;
  }
  if (typeof value === 'string') {
    if (HEX_WORD_PATTERN.test(value)) {
      if (DECIMAL_PATTERN.test(value) && value[0] !== '0') {
        return null;
      }
      return BigInt('0x' + value);
    }
    if (DECIMAL_PATTERN.test(value) || HEX_PATTERN.test(value)) {
      return BigInt(value);
    }
  }
  return null;
}

/** Copy of `values` with every parseable number-typed field of `fields` replaced by its bigint. */
export function normalizeEip712Numbers(
  fields: IEIP712Field[],
  values: Record<string, unknown>,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...values };
  for (const { name, type } of fields) {
    if (!parseNumberType(type)) {
      continue;
    }
    const parsed = parseEip712Number(values[name]);
    if (parsed !== null) {
      normalized[name] = parsed;
    }
  }
  return normalized;
}
