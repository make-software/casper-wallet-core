import { DeployDto } from './DeployDto';
import { getEntryPoint } from './common';
import type { ExtendedCloudDeploy, ICloudTransactionFeedItem } from '../../repositories';
import { IAccountInfo, IAssociatedKeysDeploy, Network } from '../../../domain';
import { Maybe } from '../../../typings';

export class AssociatedKeysDeployDto extends DeployDto implements IAssociatedKeysDeploy {
  constructor(
    network: Network,
    activePublicKey: string,
    data?: Partial<ExtendedCloudDeploy | ICloudTransactionFeedItem>,
    accountInfoMap: Record<string, IAccountInfo> = {},
  ) {
    super(network, activePublicKey, data, accountInfoMap);
    this.contractName = data?.contract_package?.name ?? '';
    this.entryPoint = getEntryPoint(data) ?? null;
  }

  override readonly entryPoint: Maybe<string>;
  override readonly contractName: string;
}
