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

  const word = (tail: string) => tail.padStart(64, '0');

  it.each([
    [word('3e8'), 1000n],
    [
      '5e38ac48c5f84e841a8b87d06afc49adb9aa117f1eb4dd4c797bf1c0d3a032be',
      BigInt('0x5e38ac48c5f84e841a8b87d06afc49adb9aa117f1eb4dd4c797bf1c0d3a032be'),
    ],
    [word('3E8'), 1000n],
    [word('10'), 16n],
    [word('1'), 1n],
    ['f'.repeat(64), (1n << 256n) - 1n],
    ['1000', 1000n],
    [((1n << 256n) - 1n).toString(), (1n << 256n) - 1n],
    ['0x03e8', 1000n],
  ])('reads %p as %p', (value, expected) => expect(parseEip712Number(value)).toBe(expected));

  it.each([
    ['1' + '0'.repeat(63)],
    ['3e8'],
    ['03e8'],
    ['3' + 'e'.repeat(62)],
    ['0'.repeat(62) + '3e8'],
  ])('rejects unprefixed %p', value => expect(parseEip712Number(value)).toBeNull());

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
