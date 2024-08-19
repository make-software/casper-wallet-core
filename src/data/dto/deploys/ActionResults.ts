import {
  formatTokenBalance,
  getDecimalTokenBalance,
  getUniqueId,
  isKeysEqual,
} from '../../../utils';
import {
  AccountKeyType,
  CEP18EntryPointType,
  CSPR_COIN,
  IAccountInfo,
  ICep18ActionsResult,
  INftActionsResult,
  ITransferActionsResult,
  NFTEntryPointType,
} from '../../../domain';
import { getAccountInfoFromMap, getCsprFiatAmount } from './common';
import { ExtendedCloudDeploy } from '../../repositories';

const mapCep18EntryPointIdToName: Record<number, CEP18EntryPointType> = {
  1: 'mint',
  2: 'transfer',
  3: 'approve',
  4: 'burn',
};

const mapNftentryPointIdToName: Record<number, NFTEntryPointType> = {
  1: 'mint',
  2: 'burn',
  3: 'approve',
  4: 'transfer',
  5: 'update_token_meta',
};

export function getCep18ActionsResult(
  activePublicKey: string,
  deploy?: Partial<ExtendedCloudDeploy>,
  accountInfoMap: Record<string, IAccountInfo> = {},
) {
  return (
    deploy?.ft_token_actions?.map<ICep18ActionsResult>(action => {
      const recipientKey = action?.to_public_key ?? action?.to_hash ?? '';
      const recipientKeyType: AccountKeyType = action?.to_public_key ? 'publicKey' : 'accountHash';
      const recipientAccountInfo = getAccountInfoFromMap(
        accountInfoMap,
        recipientKey,
        recipientKeyType,
      );

      const callerPublicKey = action?.from_public_key ?? action?.from_hash ?? '';
      const callerPublicKeyType: AccountKeyType = action?.from_public_key
        ? 'publicKey'
        : 'accountHash';
      const callerAccountInfo = getAccountInfoFromMap(
        accountInfoMap,
        callerPublicKey,
        callerPublicKeyType,
      );

      return {
        recipientAccountInfo,
        recipientKey: recipientAccountInfo?.publicKey ?? recipientKey,
        recipientKeyType: recipientAccountInfo?.publicKey ? 'publicKey' : recipientKeyType,
        callerAccountInfo,
        callerPublicKey: callerAccountInfo?.publicKey ?? callerPublicKey,
        callerKeyType: callerAccountInfo?.publicKey ? 'publicKey' : callerPublicKeyType,
        symbol: action?.contract_package?.metadata?.symbol ?? '',
        contractName: action?.contract_package?.name ?? '',
        iconUrl: action?.contract_package?.icon_url ?? '',
        isReceive: isKeysEqual(activePublicKey, recipientAccountInfo?.publicKey ?? recipientKey),
        decimals: action?.contract_package?.metadata?.decimals ?? 0,
        amount: action.amount,
        decimalAmount: getDecimalTokenBalance(
          action.amount,
          action?.contract_package?.metadata?.decimals ?? 0,
        ),
        formattedDecimalAmount: formatTokenBalance(
          action.amount,
          action?.contract_package?.metadata?.decimals ?? 0,
        ),
        entryPoint: mapCep18EntryPointIdToName[action.ft_action_type_id],
        timestamp: action?.timestamp,
        id: getUniqueId(),
      };
    }) ?? []
  );
}

export function getNftActionsResult(
  activePublicKey: string,
  deploy?: Partial<ExtendedCloudDeploy>,
  accountInfoMap: Record<string, IAccountInfo> = {},
) {
  return (
    deploy?.nft_token_actions?.map<INftActionsResult>(action => {
      const recipientKey = action?.to_public_key ?? action?.to_hash ?? '';
      const recipientKeyType: AccountKeyType = action?.to_public_key ? 'publicKey' : 'accountHash';
      const recipientAccountInfo = getAccountInfoFromMap(
        accountInfoMap,
        recipientKey,
        recipientKeyType,
      );

      const callerPublicKey = action?.from_public_key ?? action?.from_hash ?? '';
      const callerPublicKeyType: AccountKeyType = action?.from_public_key
        ? 'publicKey'
        : 'accountHash';
      const callerAccountInfo = getAccountInfoFromMap(
        accountInfoMap,
        callerPublicKey,
        callerPublicKeyType,
      );

      return {
        recipientAccountInfo,
        recipientKey: recipientAccountInfo?.publicKey ?? recipientKey,
        isReceive: isKeysEqual(activePublicKey, recipientAccountInfo?.publicKey ?? recipientKey),
        recipientKeyType: recipientAccountInfo?.publicKey ? 'publicKey' : recipientKeyType,
        callerAccountInfo,
        callerPublicKey: callerAccountInfo?.publicKey ?? callerPublicKey,
        callerKeyType: callerAccountInfo?.publicKey ? 'publicKey' : callerPublicKeyType,
        contractName: action?.contract_package?.name ?? '',
        iconUrl: action?.contract_package?.icon_url ?? '',
        entryPoint: mapNftentryPointIdToName[action.nft_action_id],
        timestamp: action?.timestamp,
        id: getUniqueId(),
        nftTokenIds: action?.token_id ? [action?.token_id] : [],
      };
    }) ?? []
  );
}

export function getTransferActionsResult(
  activePublicKey: string,
  deploy?: Partial<ExtendedCloudDeploy>,
  accountInfoMap: Record<string, IAccountInfo> = {},
) {
  return (
    deploy?.transfers?.map<ITransferActionsResult>(action => {
      const recipientKey =
        action?.to_purse_public_key ?? action?.to_account_hash ?? action?.to_purse ?? '';
      const recipientKeyType = action?.to_purse_public_key
        ? 'publicKey'
        : action?.to_account_hash
          ? 'accountHash'
          : 'purse';
      const recipientAccountInfo = getAccountInfoFromMap(
        accountInfoMap,
        recipientKey,
        recipientKeyType,
      );

      const callerPublicKey = action?.from_purse_public_key ?? action?.from_purse ?? '';
      const callerKeyType: AccountKeyType = action?.from_purse_public_key ? 'publicKey' : 'purse';
      const callerAccountInfo = getAccountInfoFromMap(
        accountInfoMap,
        callerPublicKey,
        callerKeyType,
      );

      return {
        recipientAccountInfo,
        recipientKey: recipientAccountInfo?.publicKey ?? recipientKey,
        recipientKeyType: recipientAccountInfo?.publicKey ? 'publicKey' : recipientKeyType,
        isReceive: isKeysEqual(activePublicKey, recipientAccountInfo?.publicKey ?? recipientKey),
        callerAccountInfo,
        callerPublicKey: callerAccountInfo?.publicKey ?? callerPublicKey,
        callerKeyType: callerAccountInfo?.publicKey ? 'publicKey' : callerKeyType,
        timestamp: action?.timestamp,
        id: getUniqueId(),
        amount: action.amount,
        decimalAmount: getDecimalTokenBalance(action.amount, CSPR_COIN.decimals),
        formattedDecimalAmount: formatTokenBalance(action.amount, CSPR_COIN.decimals),
        fiatAmount: getCsprFiatAmount(
          action.amount,
          deploy?.time_transaction_currency_rate ?? deploy?.rate,
        ),
      };
    }) ?? []
  );
}
