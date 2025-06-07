import { CasperNetwork, IAccountInfo } from '../../domain';
import { ICloudResolveFromCsprNameResponse, IGetAccountsInfoResponse } from '../repositories';
import { Maybe } from '../../typings';
import { getBlockExplorerAccountUrl } from '../../utils';

export class AccountsInfoDto implements IAccountInfo {
  constructor(network: CasperNetwork, result?: Partial<IGetAccountsInfoResponse>) {
    this.publicKey = result?.public_key ?? '';
    this.id = this.publicKey;
    this.accountHash = result?.account_hash ?? '';
    this.name =
      result?.account_info?.info?.owner?.name ?? result?.centralized_account_info?.name ?? '';
    const brandingLogoObj = result?.account_info?.info?.owner?.branding?.logo;
    this.brandingLogo =
      brandingLogoObj?.png_256 ??
      brandingLogoObj?.svg ??
      brandingLogoObj?.png_1024 ??
      result?.centralized_account_info?.avatar_url ??
      null;
    this.csprName = result?.cspr_name ?? null;
    this.explorerLink = getBlockExplorerAccountUrl(network, this.publicKey || this.accountHash);
  }

  readonly publicKey: string;
  readonly accountHash: string;
  readonly name: string;
  readonly brandingLogo: Maybe<string>;
  readonly id: string;
  readonly csprName: Maybe<string>;
  readonly explorerLink: Maybe<string>;
}

export class AccountsInfoResolutionFromCsprNameDto implements IAccountInfo {
  constructor(network: CasperNetwork, result?: Partial<ICloudResolveFromCsprNameResponse>) {
    this.publicKey = result?.resolved_public_key ?? '';
    this.id = this.publicKey;
    this.accountHash = result?.resolved_hash ?? '';
    this.name =
      result?.account_info?.info?.owner?.name ?? result?.centralized_account_info?.name ?? '';
    const brandingLogoObj = result?.account_info?.info?.owner?.branding?.logo;
    this.brandingLogo =
      brandingLogoObj?.png_256 ??
      brandingLogoObj?.svg ??
      brandingLogoObj?.png_1024 ??
      result?.centralized_account_info?.avatar_url ??
      null;
    this.csprName = result?.name ?? null;
    this.explorerLink = getBlockExplorerAccountUrl(network, this.publicKey || this.accountHash);
  }

  readonly publicKey: string;
  readonly accountHash: string;
  readonly name: string;
  readonly brandingLogo: Maybe<string>;
  readonly id: string;
  readonly csprName: Maybe<string>;
  readonly explorerLink: Maybe<string>;
}
