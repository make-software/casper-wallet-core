import { parseEip712FieldType } from './types';

describe('parseEip712FieldType', () => {
  it.each([
    ['uint256', { base: 'uint256', isArray: false, arrayLength: null }],
    ['TokenPermissions[]', { base: 'TokenPermissions', isArray: true, arrayLength: null }],
    ['address[3]', { base: 'address', isArray: true, arrayLength: 3 }],
    ['uint256[64]', { base: 'uint256', isArray: true, arrayLength: 64 }],
  ])('parses %s', (type, expected) => {
    expect(parseEip712FieldType(type)).toEqual(expected);
  });

  it.each(['uint256[][]', 'uint256[2][3]', 'uint256[0]', 'uint256[65]', 'uint256[01]', 'uint256['])(
    'returns null for %s',
    type => {
      expect(parseEip712FieldType(type)).toBeNull();
    },
  );
});
