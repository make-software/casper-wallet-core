import { normalizeEip712Numbers, parseEip712Number, parseNumberType } from './numbers';

describe('parseNumberType', () => {
  it.each([
    ['uint256', { unsigned: true, bits: 256 }],
    ['int8', { unsigned: false, bits: 8 }],
    ['uint', { unsigned: true, bits: 256 }],
    ['int', { unsigned: false, bits: 256 }],
  ])('parses %s', (type, expected) => expect(parseNumberType(type)).toEqual(expected));

  it.each(['uint7', 'uint264', 'int0', 'uintFoo', 'address', 'bytes32'])(
    'returns null for %s',
    type => expect(parseNumberType(type)).toBeNull(),
  );
});

describe('parseEip712Number', () => {
  it('accepts every reference-compatible form as the same bigint', () => {
    expect(parseEip712Number('1000')).toBe(1000n);
    expect(parseEip712Number('0x03e8')).toBe(1000n);
    expect(parseEip712Number('0x' + 'ff'.repeat(32))).toBe((1n << 256n) - 1n);
    expect(parseEip712Number(1000)).toBe(1000n);
    expect(parseEip712Number(1000n)).toBe(1000n);
    expect(parseEip712Number(-1n)).toBe(-1n);
  });

  it.each([
    ['-1'],
    ['0x3e8'],
    ['0X03e8'],
    ['0x'],
    ['0x' + '00'.repeat(33)],
    [''],
    [' 1'],
    ['1e3'],
    ['1_000'],
    ['+1'],
    [2 ** 53],
    [1.5],
    [true],
    [null],
    [undefined],
    [{}],
  ])('returns null for %p', value => expect(parseEip712Number(value)).toBeNull());
});

describe('normalizeEip712Numbers', () => {
  const fields = [
    { name: 'a', type: 'uint256' },
    { name: 's', type: 'string' },
  ];

  it('replaces number-typed fields with bigints and leaves the rest', () => {
    const input = { a: '1000', s: '1000' };
    expect(normalizeEip712Numbers(fields, input)).toEqual({ a: 1000n, s: '1000' });
    expect(input.a).toBe('1000');
  });

  it('leaves an unparseable number untouched', () => {
    expect(normalizeEip712Numbers(fields, { a: 'abc', s: 'x' })).toEqual({ a: 'abc', s: 'x' });
  });
});
