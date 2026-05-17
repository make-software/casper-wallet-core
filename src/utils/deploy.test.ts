import {
  isAssociatedKeysDeploy,
  isAuctionDeploy,
  isCasperMarketDeploy,
  isCep18Deploy,
  isContractCallExecutionType,
  isNativeCsprDeploy,
  isNftDeploy,
  isTransferExecutionType,
  isUnknownDeploy,
  isWasmDeploy,
  isWasmProxyDeploy,
} from './deploy';
import type { IDeploy } from '../domain';

const deployOfType = (type: IDeploy['type'], executionTypeId = 1): IDeploy =>
  ({ type, executionTypeId } as unknown as IDeploy);

describe('deploy type guards', () => {
  it.each<[string, (d: IDeploy) => boolean, IDeploy['type']]>([
    ['AUCTION', isAuctionDeploy, 'AUCTION'],
    ['ASSOCIATED_KEYS', isAssociatedKeysDeploy, 'ASSOCIATED_KEYS'],
    ['CSPR_MARKET', isCasperMarketDeploy, 'CSPR_MARKET'],
    ['CEP18', isCep18Deploy, 'CEP18'],
    ['CSPR_NATIVE', isNativeCsprDeploy, 'CSPR_NATIVE'],
    ['NFT', isNftDeploy, 'NFT'],
    ['WASM', isWasmDeploy, 'WASM'],
    ['WASM_PROXY', isWasmProxyDeploy, 'WASM_PROXY'],
    ['UNKNOWN', isUnknownDeploy, 'UNKNOWN'],
  ])('matches its own type (%s)', (_label, guard, type) => {
    expect(guard(deployOfType(type))).toBe(true);
  });

  it('does not match a different type', () => {
    expect(isAuctionDeploy(deployOfType('CEP18'))).toBe(false);
    expect(isCep18Deploy(deployOfType('AUCTION'))).toBe(false);
    expect(isNftDeploy(deployOfType('CSPR_NATIVE'))).toBe(false);
  });

  describe('execution type helpers', () => {
    it.each([
      [1, false],
      [2, true],
      [3, true],
      [4, true],
      [5, true],
      [6, false],
    ])('isContractCallExecutionType(%s) → %s', (id, expected) => {
      expect(isContractCallExecutionType(deployOfType('CEP18', id))).toBe(expected);
    });

    it.each([
      [1, false],
      [5, false],
      [6, true],
    ])('isTransferExecutionType(%s) → %s', (id, expected) => {
      expect(isTransferExecutionType(deployOfType('CEP18', id))).toBe(expected);
    });
  });
});
