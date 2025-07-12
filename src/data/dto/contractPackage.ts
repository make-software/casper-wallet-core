import { IContractPackage } from '../../domain';
import { IContractPackageCloudResponse } from '../repositories/contractPackage';
import { Maybe } from '../../typings';

export class ContractPackageDto implements IContractPackage {
  constructor(apiContractPackage?: Partial<IContractPackageCloudResponse>) {
    this.contractPackageHash = apiContractPackage?.contract_package_hash ?? '';
    this.decimals = apiContractPackage?.metadata?.decimals ?? 0;
    this.symbol = apiContractPackage?.metadata?.symbol ?? '';
    this.iconUrl = apiContractPackage?.icon_url ?? null;
    this.id = this.contractPackageHash;
    this.latestVersionContractTypeId = apiContractPackage?.latest_version_contract_type_id ?? 0;
    this.name = apiContractPackage?.name ?? '';
  }

  readonly contractPackageHash: string;
  readonly decimals: number;
  readonly iconUrl: Maybe<string>;
  readonly id: string;
  readonly latestVersionContractTypeId: number;
  readonly name: string;
  readonly symbol: string;
}
