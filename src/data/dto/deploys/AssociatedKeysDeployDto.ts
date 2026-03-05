import { DeployDto } from './DeployDto';
import { getEntryPoint } from './common';
import { ExtendedCloudDeploy, ICloudTransactionFeedItem } from '../../repositories';
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

  readonly entryPoint: Maybe<string>;
  readonly contractName: string;
}
