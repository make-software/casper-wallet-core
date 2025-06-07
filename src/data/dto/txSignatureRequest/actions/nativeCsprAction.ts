import { Conversions, Transaction, TypeID } from 'casper-js-sdk';
import {
  AccountKeyType,
  CSPR_COIN,
  IAccountInfo,
  InvalidSignatureRequestError,
  ITxSignatureRequestNativeCsprAction,
} from '../../../../domain';
import { getAccountInfoFromMap, getCsprFiatAmount } from '../../common';
import { formatTokenBalance, getDecimalTokenBalance } from '../../../../utils';

export function getTxSignatureRequestNativeCsprAction(
  tx: Transaction,
  csprFiatRate: string,
  accountInfoMap: Record<string, IAccountInfo> = {},
): ITxSignatureRequestNativeCsprAction {
  const targetFromDeploy = tx.args.getByName('target');

  if (!targetFromDeploy) {
    throw new InvalidSignatureRequestError("Couldn't find 'target' in transfer data");
  }

  let recipientKey: string = '';
  let recipientKeyType: AccountKeyType = 'publicKey';

  switch (targetFromDeploy.type.getTypeID()) {
    case TypeID.ByteArray:
      recipientKey = Conversions.encodeBase16(targetFromDeploy.bytes());
      recipientKeyType = 'accountHash';
      break;

    case TypeID.PublicKey:
      if (targetFromDeploy.publicKey) {
        recipientKey = targetFromDeploy.publicKey.toHex();
        recipientKeyType = 'publicKey';
      }
      break;

    default: {
      throw new InvalidSignatureRequestError('Target from tx was neither AccountHash or PublicKey');
    }
  }

  const amount = tx.args.getByName('amount')?.toString();

  if (!amount) {
    throw new InvalidSignatureRequestError("Couldn't find 'amount' in transfer data");
  }

  const recipientAccountInfo = getAccountInfoFromMap(
    accountInfoMap,
    recipientKey,
    recipientKeyType,
  );

  return {
    amount,
    decimalAmount: getDecimalTokenBalance(amount, CSPR_COIN.decimals),
    formattedDecimalAmount: formatTokenBalance(amount, CSPR_COIN.decimals),
    fiatAmount: getCsprFiatAmount(amount, csprFiatRate),
    decimals: CSPR_COIN.decimals,
    recipientAccountInfo,
    recipientKey: recipientAccountInfo?.publicKey ?? recipientKey,
    recipientKeyType: recipientAccountInfo?.publicKey ? 'publicKey' : recipientKeyType,
    symbol: CSPR_COIN.symbol,
    type: 'CSPR_NATIVE',
  };
}
