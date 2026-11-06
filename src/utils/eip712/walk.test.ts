import { PERMIT2_MESSAGES, PERMIT2_TYPES } from '../../__test-utils__/permit2';
import { getTypedDataEIP712Leaves, pathToLabel } from './walk';

describe('getTypedDataEIP712Leaves', () => {
  it('walks a nested struct in declaration order', () => {
    const leaves = getTypedDataEIP712Leaves(
      'PermitTransferFrom',
      PERMIT2_TYPES,
      PERMIT2_MESSAGES.PermitTransferFrom[20],
    );
    expect(leaves.map(l => l.path)).toEqual([
      ['permitted', 'token'],
      ['permitted', 'amount'],
      ['spender'],
      ['nonce'],
      ['deadline'],
    ]);
    expect(leaves[0].type).toBe('address');
    expect(leaves[1].value).toBe('1000');
  });

  it('exposes the holding struct as parentFields and parentValue', () => {
    const [token] = getTypedDataEIP712Leaves(
      'PermitTransferFrom',
      PERMIT2_TYPES,
      PERMIT2_MESSAGES.PermitTransferFrom[20],
    );
    expect(token.parentFields).toBe(PERMIT2_TYPES.TokenPermissions);
    expect(token.parentValue).toBe(
      (PERMIT2_MESSAGES.PermitTransferFrom[20] as { permitted: object }).permitted,
    );
  });

  it('walks struct arrays with zero-based indexes', () => {
    const leaves = getTypedDataEIP712Leaves(
      'PermitBatch',
      PERMIT2_TYPES,
      PERMIT2_MESSAGES.PermitBatch[20],
    );
    expect(leaves).toHaveLength(10);
    expect(leaves[7].path).toEqual(['details', 1, 'nonce']);
    expect(leaves[8].path).toEqual(['spender']);
  });

  it('yields one leaf per primitive array element', () => {
    const types = { T: [{ name: 'amounts', type: 'uint256[]' }] };
    const leaves = getTypedDataEIP712Leaves('T', types, { amounts: ['1', '2'] });
    expect(leaves.map(l => [l.path, l.type, l.value])).toEqual([
      [['amounts', 0], 'uint256', '1'],
      [['amounts', 1], 'uint256', '2'],
    ]);
  });

  it('yields one leaf typed as the array for an empty array', () => {
    const leaves = getTypedDataEIP712Leaves('PermitBatchTransferFrom', PERMIT2_TYPES, {
      ...PERMIT2_MESSAGES.PermitBatchTransferFrom[20],
      permitted: [],
    });
    expect(leaves[0]).toMatchObject({
      path: ['permitted'],
      type: 'TokenPermissions[]',
      value: [],
    });
    expect(leaves).toHaveLength(4);
  });

  it('walks witness structs', () => {
    const leaves = getTypedDataEIP712Leaves(
      'PermitWitnessTransferFrom',
      PERMIT2_TYPES,
      PERMIT2_MESSAGES.PermitWitnessTransferFrom[20],
    );
    expect(leaves.slice(-2).map(l => l.path)).toEqual([
      ['witness', 'recipient'],
      ['witness', 'orderId'],
    ]);
  });
});

describe('pathToLabel', () => {
  it('joins path segments with a separator and numbers array entries from 1', () => {
    expect(pathToLabel(['permitted', 0, 'token'])).toBe('Permitted #1 › Token');
    expect(pathToLabel(['sigDeadline'])).toBe('Sig Deadline');
    expect(pathToLabel(['amounts', 2])).toBe('Amounts #3');
    expect(pathToLabel(['witness', 'orderId'])).toBe('Witness › Order Id');
  });
});
