import { DeployDto, getDeployStatus } from './DeployDto';
import { processDeploy } from './index';
import { makeCloudDeploy } from '../../../__test-utils__';
import { AuctionManagerContractHash, CSPRMarketContractHash } from '../../../domain';

const ACTIVE_KEY = '0106956df3aba7115e28271d053205ec7f33cab259f8e2da2f38150f0ece65a2a8';

describe('DeployDto (base)', () => {
  it('produces a deploy with default fields when no data', () => {
    const dto = new DeployDto('mainnet', ACTIVE_KEY);
    expect(dto.deployHash).toBe('');
    expect(dto.id).toBe('');
    expect(dto.executionTypeId).toBe(1);
    expect(dto.status).toBe('success');
    expect(dto.cost).toBe('0');
    expect(dto.transfersActionsResult).toEqual([]);
    expect(dto.cep18ActionsResult).toEqual([]);
    expect(dto.nftActionsResult).toEqual([]);
  });

  it('maps caller and timestamp from cloud data', () => {
    const dto = new DeployDto('mainnet', ACTIVE_KEY, makeCloudDeploy());
    expect(dto.callerPublicKey).toBeTruthy();
    expect(dto.timestamp).toBe('2024-01-01T00:00:00.000Z');
    expect(dto.formattedCost).toBeTruthy();
  });
});

describe('getDeployStatus', () => {
  it('returns "error" when error_message exists', () => {
    expect(getDeployStatus({ error_message: 'boom' })).toBe('error');
  });

  it('returns the raw status if non-executed', () => {
    expect(getDeployStatus({ status: 'pending' })).toBe('pending');
  });

  it('returns "success" by default', () => {
    expect(getDeployStatus({ status: 'executed' })).toBe('success');
    expect(getDeployStatus({})).toBe('success');
    expect(getDeployStatus(undefined)).toBe('success');
  });
});

describe('processDeploy (factory)', () => {
  it('returns an UNKNOWN deploy for empty data', () => {
    const out = processDeploy(ACTIVE_KEY, 'mainnet', {});
    expect(out.type).toBe('UNKNOWN');
  });

  it('routes to AUCTION when contract_hash matches the auction contract', () => {
    const data = makeCloudDeploy({ contract_hash: AuctionManagerContractHash.mainnet });
    const out = processDeploy(ACTIVE_KEY, 'mainnet', {}, data);
    expect(out.type).toBe('AUCTION');
  });

  it('routes to CSPR_MARKET when contract_hash matches the market contract', () => {
    const data = makeCloudDeploy({ contract_hash: CSPRMarketContractHash.mainnet });
    const out = processDeploy(ACTIVE_KEY, 'mainnet', {}, data);
    expect(out.type).toBe('CSPR_MARKET');
  });

  it('routes to CSPR_NATIVE for execution_type_id=6', () => {
    const data = makeCloudDeploy({ execution_type_id: 6 });
    const out = processDeploy(ACTIVE_KEY, 'mainnet', {}, data);
    expect(out.type).toBe('CSPR_NATIVE');
  });
});
