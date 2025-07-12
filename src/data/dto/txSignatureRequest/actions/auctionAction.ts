import { Transaction, TypeID } from 'casper-js-sdk';
import {
  CSPR_COIN,
  IAccountInfo,
  IContractPackage,
  ITxSignatureRequestAuctionAction,
} from '../../../../domain';
import { Maybe } from '../../../../typings';
import { deriveKeyType, getAccountInfoFromMap, getCsprFiatAmount } from '../../common';
import { formatTokenBalance, getDecimalTokenBalance } from '../../../../utils';
import { getContractInfo } from '../common';

export function getTxSignatureRequestAuctionAction(
  tx: Transaction,
  accountInfoMap: Record<string, IAccountInfo> = {},
  csprFiatRate: string,
  signingPublicKeyHex: string,
  contractPackage: Maybe<IContractPackage>,
): ITxSignatureRequestAuctionAction {
  const amount = tx.args.getByName('amount')?.toString() ?? '0';
  const entryPoint = getAuctionEntryPoint(tx);

  const fromValidator = getFromValidator(tx, entryPoint);
  const fromValidatorKeyType = deriveKeyType(fromValidator);
  const fromValidatorAccountInfo = getAccountInfoFromMap(
    accountInfoMap,
    fromValidator,
    fromValidatorKeyType,
  );

  const toValidator = getToValidator(tx, entryPoint, signingPublicKeyHex);
  const toValidatorKeyType = deriveKeyType(toValidator);
  const toValidatorAccountInfo = getAccountInfoFromMap(
    accountInfoMap,
    toValidator,
    toValidatorKeyType,
  );

  return {
    type: 'AUCTION',
    entryPoint,
    amount,
    decimalAmount: getDecimalTokenBalance(amount, CSPR_COIN.decimals),
    formattedDecimalAmount: formatTokenBalance(amount, CSPR_COIN.decimals),
    fiatAmount: getCsprFiatAmount(amount, csprFiatRate),
    decimals: CSPR_COIN.decimals,
    symbol: CSPR_COIN.symbol,

    fromValidatorAccountInfo,
    fromValidator: fromValidatorAccountInfo?.publicKey ?? fromValidator,
    fromValidatorKeyType: fromValidatorAccountInfo?.publicKey ? 'publicKey' : fromValidatorKeyType,

    toValidatorAccountInfo,
    toValidator: toValidatorAccountInfo?.publicKey ?? toValidator,
    toValidatorKeyType: toValidatorAccountInfo?.publicKey ? 'publicKey' : toValidatorKeyType,

    ...getContractInfo(tx, contractPackage),
  };
}

function getAuctionEntryPoint(tx: Transaction): string {
  if (tx.getDeploy()) {
    return tx.entryPoint.customEntryPoint ?? '';
  }

  return tx.entryPoint.type.toString();
}

function getFromValidator(tx: Transaction, entryPoint: string): string | null {
  if (entryPoint.toLowerCase() === 'undelegate' || entryPoint.toLowerCase() === 'redelegate') {
    const validator = tx.args.getByName('validator');
    return validator?.type.getTypeID() === TypeID.PublicKey ? validator.toString() : null;
  }

  return null;
}

function getToValidator(tx: Transaction, entryPoint: string, signingPublicKeyHex: string) {
  const new_validator = tx.args.getByName('new_validator');

  if (new_validator) {
    return new_validator.type.getTypeID() === TypeID.PublicKey ? new_validator.toString() : '';
  } else if (entryPoint.toLowerCase() !== 'undelegate') {
    const validator = tx.args.getByName('validator');

    return validator?.type.getTypeID() === TypeID.PublicKey ? validator.toString() : '';
  } else if (entryPoint.toLowerCase() === 'undelegate') {
    return signingPublicKeyHex;
  }

  return null;
}
