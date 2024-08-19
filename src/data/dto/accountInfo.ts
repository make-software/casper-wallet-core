import { IAccountInfo } from '../../domain';
import { IGetAccountsInfoResponse } from '../repositories';
import { Maybe } from '../../typings';

export class AccountsInfoDto implements IAccountInfo {
  constructor(result?: Partial<IGetAccountsInfoResponse>) {
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
  }

  publicKey: string;
  accountHash: string;
  name: string;
  brandingLogo: Maybe<string>;
  id: string;
}
