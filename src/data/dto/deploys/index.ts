import { ExtendedCloudDeploy } from '../../repositories';
import { NativeCsprDeployDto } from './NativeCsprDeployDto';
import { Cep18DeployDto } from './Cep18DeployDto';
import { NftDeployDto } from './NftDeployDto';
import { AuctionDeployDto } from './AuctionDeployDto';
import { CsprMarketDeployDto } from './CsprMarketDeployDto';
import { AssociatedKeysDeployDto } from './AssociatedKeysDeployDto';
import { DeployDto } from './DeployDto';
import { getDeployType } from './common';
import { IAccountInfo, IDeploy, Network } from '../../../domain';

export * from './CsprTransferDeployDto';
export * from './Cep18transferDeployDto';

export function processDeploy(
  activePublicKey: string,
  network: Network,
  accountInfoMap: Record<string, IAccountInfo>,
  data?: Partial<ExtendedCloudDeploy>,
): IDeploy {
  const type = getDeployType(network, data);

  switch (type) {
    case 'CSPR_NATIVE':
      return new NativeCsprDeployDto(network, activePublicKey, data, accountInfoMap);
    case 'CEP18':
      return new Cep18DeployDto(network, activePublicKey, data, accountInfoMap);
    case 'NFT':
      return new NftDeployDto(network, activePublicKey, data, accountInfoMap);
    case 'AUCTION':
      return new AuctionDeployDto(network, activePublicKey, data, accountInfoMap);
    case 'CSPR_MARKET':
      return new CsprMarketDeployDto(network, activePublicKey, data, accountInfoMap);
    case 'ASSOCIATED_KEYS':
      return new AssociatedKeysDeployDto(network, activePublicKey, data, accountInfoMap);
    case 'UNKNOWN':
    default:
      return new DeployDto(network, activePublicKey, data, accountInfoMap);
  }
}
