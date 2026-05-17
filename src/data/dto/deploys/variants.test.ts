import { processDeploy } from './index';
import { makeCloudDeploy } from '../../../__test-utils__';
import { AuctionManagerContractHash, CSPRMarketContractHash, AssociatedKeysContractHash } from '../../../domain';

const ACTIVE_KEY = '0106956df3aba7115e28271d053205ec7f33cab259f8e2da2f38150f0ece65a2a8';

describe('Deploy variant DTOs (via processDeploy)', () => {
  it('builds an AuctionDeployDto with extracted validators', () => {
    const data = makeCloudDeploy({
      contract_hash: AuctionManagerContractHash.mainnet,
      contract_entrypoint: { name: 'delegate' } as never,
      args: { validator: { cl_type: 'PublicKey', parsed: 'val1' } as never } as never,
    });

    const out = processDeploy(ACTIVE_KEY, 'mainnet', {}, data) as any;
    expect(out.type).toBe('AUCTION');
    expect(out.entryPoint).toBe('delegate');
    expect(out.toValidator).toBe('val1');
  });

  it('builds an AssociatedKeysDeployDto', () => {
    const data = makeCloudDeploy({
      contract_hash: AssociatedKeysContractHash.mainnet,
    });
    const out = processDeploy(ACTIVE_KEY, 'mainnet', {}, data);
    expect(out.type).toBe('ASSOCIATED_KEYS');
  });

  it('builds a CsprMarketDeployDto', () => {
    const data = makeCloudDeploy({
      contract_hash: CSPRMarketContractHash.mainnet,
      contract_entrypoint: { name: 'list_token' } as never,
    });
    const out = processDeploy(ACTIVE_KEY, 'mainnet', {}, data);
    expect(out.type).toBe('CSPR_MARKET');
  });

  it('builds an Cep18DeployDto for CEP18 entry point', () => {
    const data = makeCloudDeploy({
      contract_entrypoint: { name: 'transfer' } as never,
      contract_package: {
        contract_type_id: 2,
        metadata: { decimals: 9, symbol: 'STK' },
        name: 'STK',
      } as never,
    });
    const out = processDeploy(ACTIVE_KEY, 'mainnet', {}, data);
    expect(out.type).toBe('CEP18');
  });

  it('builds an NftDeployDto for NFT entry point', () => {
    const data = makeCloudDeploy({
      contract_entrypoint: { name: 'transfer' } as never,
      contract_package: {
        contract_type_id: 4,
        metadata: { decimals: 0, symbol: '' },
        name: 'CollX',
      } as never,
    });
    const out = processDeploy(ACTIVE_KEY, 'mainnet', {}, data);
    expect(out.type).toBe('NFT');
  });

  it('builds a NativeCsprDeployDto for execution_type_id=6', () => {
    const out = processDeploy(ACTIVE_KEY, 'mainnet', {}, makeCloudDeploy({ execution_type_id: 6 }));
    expect(out.type).toBe('CSPR_NATIVE');
  });
});
