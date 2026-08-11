import { CasperNetwork, IAccountInfo } from '../../domain';
import type {
  DeployTransferResult,
  FTActionsResult,
  ICloudAccountInfoResult,
  ICloudResolveFromCsprNameResponse,
  ICloudTransactionFeedItem,
  IGetAccountsInfoResponse,
  NftCloudActionsResult,
} from '../repositories';
import { Maybe } from '../../typings';
import { getAccountHashFromPublicKey } from '../../utils/casperSdk/accountHash';
import { getBlockExplorerAccountUrl } from '../../utils/casperSdk/blockExplorer';

export class AccountsInfoDto implements IAccountInfo {
  constructor(info: IAccountInfo) {
    this.id = info.id;
    this.publicKey = info.publicKey;
    this.accountHash = info.accountHash;
    this.name = info.name;
    this.brandingLogo = info.brandingLogo;
    this.csprName = info.csprName;
    this.csprNameExpiresAt = info.csprNameExpiresAt;
    this.explorerLink = info.explorerLink;
  }

  readonly id: string;
  readonly publicKey: string;
  readonly accountHash: string;
  readonly name: string;
  readonly brandingLogo: Maybe<string>;
  readonly csprName: Maybe<string>;
  readonly csprNameExpiresAt: Maybe<string>;
  readonly explorerLink: Maybe<string>;

  static fromGetAccountsInfoResponse(
    network: CasperNetwork,
    result?: Partial<IGetAccountsInfoResponse>,
  ) {
    const publicKey = result?.public_key ?? '';
    const accountHash = result?.account_hash ?? '';

    return new AccountsInfoDto({
      publicKey,
      id: publicKey,
      accountHash,
      name: result?.account_info?.info?.owner?.name ?? result?.centralized_account_info?.name ?? '',
      brandingLogo:
        getLogoFromAccountInfo(result?.account_info) ??
        result?.centralized_account_info?.avatar_url ??
        null,
      csprName: result?.cspr_name ?? null,
      csprNameExpiresAt: null,
      explorerLink: getBlockExplorerAccountUrl(network, publicKey || accountHash),
    });
  }

  static fromCsprNameResolution(
    network: CasperNetwork,
    result?: Partial<ICloudResolveFromCsprNameResponse>,
  ) {
    const publicKey = result?.resolved_public_key ?? '';
    const accountHash = result?.resolved_hash ?? '';

    return new AccountsInfoDto({
      publicKey,
      id: publicKey,
      accountHash,
      name: result?.account_info?.info?.owner?.name ?? result?.centralized_account_info?.name ?? '',
      brandingLogo:
        getLogoFromAccountInfo(result?.account_info) ??
        result?.centralized_account_info?.avatar_url ??
        null,
      csprName: result?.name ?? null,
      csprNameExpiresAt: result?.expires_at ?? null,
      explorerLink: getBlockExplorerAccountUrl(network, publicKey || accountHash),
    });
  }

  static fromTransactionFeedCaller(network: CasperNetwork, result?: ICloudTransactionFeedItem) {
    const publicKey = result?.caller_public_key ?? '';
    const accountHash = result?.caller_hash ?? '';

    return new AccountsInfoDto({
      publicKey,
      id: publicKey,
      accountHash,
      name: result?.account_info?.info?.owner?.name ?? result?.centralized_account_info?.name ?? '',
      brandingLogo:
        getLogoFromAccountInfo(result?.account_info) ??
        result?.centralized_account_info?.avatar_url ??
        null,
      csprName: result?.caller_cspr_name ?? null,
      csprNameExpiresAt: null,
      explorerLink: getBlockExplorerAccountUrl(network, publicKey || accountHash),
    });
  }

  static fromTransactionTransferResult(network: CasperNetwork, result?: DeployTransferResult) {
    const fromPublicKey = result?.from_purse_public_key ?? '';
    const toPublicKey = result?.to_purse_public_key ?? '';
    const fromAccountHash = fromPublicKey ? getAccountHashFromPublicKey(fromPublicKey) : '';
    const toAccountHash = toPublicKey ? getAccountHashFromPublicKey(toPublicKey) : '';

    return [
      new AccountsInfoDto({
        publicKey: fromPublicKey,
        id: fromPublicKey,
        accountHash: fromAccountHash,
        name:
          result?.from_purse_account_info?.info?.owner?.name ??
          result?.from_purse_centralized_account_info?.name ??
          '',
        brandingLogo:
          getLogoFromAccountInfo(result?.from_purse_account_info) ??
          result?.from_purse_centralized_account_info?.avatar_url ??
          null,
        csprName: result?.from_purse_cspr_name ?? null,
        csprNameExpiresAt: null,
        explorerLink: getBlockExplorerAccountUrl(network, fromPublicKey || fromAccountHash),
      }),
      new AccountsInfoDto({
        publicKey: toPublicKey,
        id: toPublicKey,
        accountHash: toAccountHash,
        name:
          result?.to_purse_account_info?.info?.owner?.name ??
          result?.to_purse_centralized_account_info?.name ??
          '',
        brandingLogo:
          getLogoFromAccountInfo(result?.to_purse_account_info) ??
          result?.to_purse_centralized_account_info?.avatar_url ??
          null,
        csprName: result?.to_purse_cspr_name ?? null,
        csprNameExpiresAt: null,
        explorerLink: getBlockExplorerAccountUrl(network, toPublicKey || toAccountHash),
      }),
    ];
  }

  static fromTransactionActionResults(
    network: CasperNetwork,
    result?: FTActionsResult | NftCloudActionsResult,
  ) {
    const fromPublicKey = result?.from_public_key ?? '';
    const toPublicKey = result?.to_public_key ?? '';
    const fromAccountHash = result?.from_hash ?? '';
    const toAccountHash = result?.to_hash ?? '';

    return [
      new AccountsInfoDto({
        publicKey: fromPublicKey,
        id: fromPublicKey,
        accountHash: fromAccountHash,
        name:
          result?.from_account_info?.info?.owner?.name ??
          result?.from_centralized_account_info?.name ??
          '',
        brandingLogo:
          getLogoFromAccountInfo(result?.from_account_info) ??
          result?.from_centralized_account_info?.avatar_url ??
          null,
        csprName: result?.from_cspr_name ?? null,
        csprNameExpiresAt: null,
        explorerLink: getBlockExplorerAccountUrl(network, fromPublicKey || fromAccountHash),
      }),
      new AccountsInfoDto({
        publicKey: toPublicKey,
        id: toPublicKey,
        accountHash: toAccountHash,
        name:
          result?.to_account_info?.info?.owner?.name ??
          result?.to_centralized_account_info?.name ??
          '',
        brandingLogo:
          getLogoFromAccountInfo(result?.to_account_info) ??
          result?.to_centralized_account_info?.avatar_url ??
          null,
        csprName: result?.to_cspr_name ?? null,
        csprNameExpiresAt: null,
        explorerLink: getBlockExplorerAccountUrl(network, toPublicKey || toAccountHash),
      }),
    ];
  }
}

function getLogoFromAccountInfo(accountInfo?: Partial<ICloudAccountInfoResult> | null) {
  const brandingLogoObj = accountInfo?.info?.owner?.branding?.logo;

  return brandingLogoObj?.png_256 ?? brandingLogoObj?.svg ?? brandingLogoObj?.png_1024;
}
