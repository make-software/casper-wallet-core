import { TypedDataEncoder } from 'ethers';
import { buildCanonicalTypeString, toHex } from '@casper-ecosystem/casper-eip-712';
import {
  PERMIT2_MESSAGES,
  PERMIT2_PRIMARY_TYPES,
  buildPermit2TypedData,
} from '../../__test-utils__/permit2';
import { IEIP712Types } from '../../domain';
import { hashTypedDataEIP712Struct } from './encode';
import { normalizeEip712Struct } from './numbers';

function oursAndEthers(
  primaryType: string,
  types: IEIP712Types,
  message: Record<string, unknown>,
): [string, string] {
  const expected = TypedDataEncoder.from(types).hash(message);
  const ours = toHex(
    hashTypedDataEIP712Struct(
      primaryType,
      types,
      normalizeEip712Struct(primaryType, types, message),
    ),
  );
  return [ours, expected];
}

describe('hashTypedDataEIP712Struct vs ethers', () => {
  it.each(PERMIT2_PRIMARY_TYPES)('matches ethers for %s', primaryType => {
    const { types, message } = buildPermit2TypedData(primaryType);
    const [ours, expected] = oursAndEthers(primaryType, types, message);
    expect(ours).toBe(expected);
  });

  it('matches ethers for primitive arrays', () => {
    const types = {
      T: [
        { name: 'a', type: 'uint256[]' },
        { name: 's', type: 'string[]' },
        { name: 'b', type: 'bytes32[2]' },
      ],
    };
    const message = {
      a: ['1', '0x02', 3n],
      s: ['x', 'yz'],
      b: ['0x' + '11'.repeat(32), '0x' + '22'.repeat(32)],
    };
    const [ours, expected] = oursAndEthers('T', types, message);
    expect(ours).toBe(expected);
  });

  it('matches ethers for an empty struct array', () => {
    const { types, message } = buildPermit2TypedData('PermitBatchTransferFrom', {
      ...PERMIT2_MESSAGES.PermitBatchTransferFrom[20],
      permitted: [],
    });
    const [ours, expected] = oursAndEthers('PermitBatchTransferFrom', types, message);
    expect(ours).toBe(expected);
  });

  it('is independent of the number form', () => {
    const base = PERMIT2_MESSAGES.PermitTransferFrom[20];
    const forms = ['1000', '0x03e8', 1000n].map(amount => {
      const { types, message } = buildPermit2TypedData('PermitTransferFrom', {
        ...base,
        permitted: { ...(base.permitted as object), amount },
      });
      return oursAndEthers('PermitTransferFrom', types, message)[0];
    });
    expect(new Set(forms).size).toBe(1);
  });
});

describe('canonical type strings', () => {
  it('builds the batch type string', () => {
    const { types } = buildPermit2TypedData('PermitBatchTransferFrom');
    expect(buildCanonicalTypeString('PermitBatchTransferFrom', types)).toBe(
      'PermitBatchTransferFrom(TokenPermissions[] permitted,address spender,uint256 nonce,uint256 deadline)TokenPermissions(address token,uint256 amount)',
    );
  });

  it('builds the witness type string', () => {
    const { types } = buildPermit2TypedData('PermitWitnessTransferFrom');
    expect(buildCanonicalTypeString('PermitWitnessTransferFrom', types)).toBe(
      'PermitWitnessTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline,ExampleWitness witness)ExampleWitness(address recipient,bytes32 orderId)TokenPermissions(address token,uint256 amount)',
    );
  });
});
