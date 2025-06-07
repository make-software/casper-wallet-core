import { AccountHash, Args, CLValue, Conversions, Hash, TypeID, URef } from 'casper-js-sdk';
import { IAccountInfo, ITxSignatureRequestArg } from '../../../../domain';
import { getAccountInfoFromMap } from '../../common';
import { getBlockExplorerAccountUrl, getBlockExplorerHashUrl } from '../../../../utils';

export function getTxSignatureRequestArgs(
  args: Args,
  accountInfoMap: Record<string, IAccountInfo>,
  chainName: string,
): Record<string, ITxSignatureRequestArg> {
  return Object.fromEntries(
    [...args.args.entries()].map<[string, ITxSignatureRequestArg]>(entry =>
      parseArg(entry, accountInfoMap, chainName),
    ),
  );
}

function parseArg(
  [key, arg]: [string, CLValue],
  accountInfoMap: Record<string, IAccountInfo>,
  chainName: string,
): [string, ITxSignatureRequestArg] {
  const type = arg.type.getTypeID();

  switch (type) {
    case TypeID.Bool:
    case TypeID.String:
      return [key, parsePrefixedStringValue(arg.toString(), chainName)];
    case TypeID.Unit:
      return [key, { type: 'string', value: 'CLValue Unit' }];
    case TypeID.I32:
    case TypeID.I64:
    case TypeID.U8:
    case TypeID.U32:
    case TypeID.U64:
    case TypeID.U128:
    case TypeID.U256:
    case TypeID.U512:
      return [key, { type: 'number', value: arg.toString() }];

    case TypeID.URef: {
      return [key, parsePrefixedStringValue(arg.uref?.toPrefixedString() ?? '', chainName)];
    }

    case TypeID.Key: {
      const keyArg = arg.key;

      if (keyArg?.account) {
        const accountInfo =
          getAccountInfoFromMap(accountInfoMap, keyArg.account.toHex(), 'accountHash') ?? undefined;

        return [
          key,
          parsePrefixedStringValue(keyArg.account.toPrefixedString(), chainName, accountInfo),
        ];
      }

      if (keyArg?.uRef) {
        return [key, parsePrefixedStringValue(keyArg.uRef.toPrefixedString(), chainName)];
      }

      if (keyArg?.hash) {
        return [key, parsePrefixedStringValue(keyArg.hash.toHex(), chainName)];
      }

      return [key, { type: 'hash', value: keyArg?.toJSON() ?? '' }];
    }

    case TypeID.Option: {
      const option = arg.option;
      const optionValue = option?.value();

      if (!optionValue) {
        const optionCLType = option?.inner?.type.toString();

        return [key, { type: 'string', value: `None${optionCLType ? ` (${optionCLType})` : ''}` }];
      }

      return [
        key,
        {
          type: 'singleInner',
          value: [parseArg([key, optionValue], accountInfoMap, chainName)[1]],
        },
      ];
    }

    case TypeID.Result: {
      const result = arg.result;
      const resultValue = result?.value();

      if (!resultValue) {
        return [key, { type: 'string', value: '' }];
      }

      return [
        key,
        {
          type: result?.isSuccess ? 'resultOk' : 'resultErr',
          value: [parseArg([key, resultValue], accountInfoMap, chainName)[1]],
        },
      ];
    }

    case TypeID.List: {
      const listElements = arg.list?.elements;

      if (!listElements || arg.list?.isEmpty()) {
        return [key, { type: 'list', value: [] }];
      }

      const isUint8Array =
        arg.list?.elements.every(elem => elem.type.getTypeID() === TypeID.U8) ?? false;

      if (isUint8Array) {
        return [
          key,
          {
            type: 'hash',
            value: Conversions.encodeBase16(
              Uint8Array.from(arg.list?.toJSON().map(elem => Number(elem)) ?? []),
            ),
          },
        ];
      }

      return [
        key,
        {
          type: 'list',
          value: listElements
            .map(elem => parseArg(['', elem], accountInfoMap, chainName))
            .map(entry => entry[1]),
        },
      ];
    }

    case TypeID.Map: {
      const map = arg.map?.getMap();

      if (!map) {
        return [key, { type: 'map', value: {} }];
      }

      return [
        key,
        {
          type: 'map',
          value: Object.fromEntries(
            Object.entries(map).map(entry => parseArg(entry, accountInfoMap, chainName)),
          ),
        },
      ];
    }

    case TypeID.Tuple1: {
      const tupleOneElem = arg.tuple1?.value();

      if (!tupleOneElem) {
        return [key, { type: 'tuple', value: [] }];
      }

      return [
        key,
        {
          type: 'tuple',
          value: [parseArg(['', tupleOneElem], accountInfoMap, chainName)[1]],
        },
      ];
    }

    case TypeID.Tuple2: {
      const tuple2Inners = arg.tuple2?.value();

      if (!tuple2Inners?.length) {
        return [key, { type: 'tuple', value: [] }];
      }

      return [
        key,
        {
          type: 'tuple',
          value: tuple2Inners
            .map(elem => parseArg(['', elem], accountInfoMap, chainName))
            .map(entry => entry[1]),
        },
      ];
    }

    case TypeID.Tuple3: {
      const tuple3Inners = arg.tuple3?.value();

      if (!tuple3Inners?.length) {
        return [key, { type: 'tuple', value: [] }];
      }

      return [
        key,
        {
          type: 'tuple',
          value: tuple3Inners
            .map(elem => parseArg(['', elem], accountInfoMap, chainName))
            .map(entry => entry[1]),
        },
      ];
    }

    case TypeID.ByteArray:
      return [
        key,
        {
          type: 'hash',
          value: Conversions.encodeBase16(arg?.byteArray?.bytes?.() ?? new Uint8Array()),
        },
      ];

    case TypeID.Any:
      return [
        key,
        { type: 'hash', value: Conversions.encodeBase16(arg.any?.bytes() ?? new Uint8Array()) },
      ];

    case TypeID.PublicKey: {
      const publicKey = arg.publicKey?.toHex() ?? '';
      const accountInfo =
        getAccountInfoFromMap(accountInfoMap, publicKey, 'publicKey') ?? undefined;
      const link = getBlockExplorerAccountUrl(chainName, publicKey);

      return [
        key,
        { type: 'accountLink', value: publicKey, accountInfo, ...(link ? { link } : {}) },
      ];
    }

    default:
      return [key, { type: 'string', value: `Unknown type: ${type}` }];
  }
}

function parsePrefixedStringValue(
  val: string,
  chainName: string,
  accountInfo?: IAccountInfo,
): ITxSignatureRequestArg {
  try {
    if (val.startsWith('uref-')) {
      const uref = URef.fromString(val);
      const link = getBlockExplorerAccountUrl(chainName, uref.toPrefixedString());

      return { type: 'uref', value: uref.toPrefixedString(), ...(link ? { link } : {}) };
    } else if (val.startsWith('account-hash-')) {
      const account = AccountHash.fromString(val);
      const link = getBlockExplorerAccountUrl(chainName, account.toHex());

      return {
        type: 'accountLink',
        value: account.toHex(),
        ...(link ? { link } : {}),
        accountInfo,
      };
    } else if (isValidHashArg(val)) {
      const hash = Hash.fromHex(val.replace(/^(hash-)?/, ''));
      const link = getBlockExplorerHashUrl(chainName, hash.toHex());

      return { type: 'hash', value: hash.toHex(), ...(link ? { link } : {}) };
    }

    return { type: 'string', value: val };
  } catch {
    return { type: 'string', value: val };
  }
}

function isValidHashArg(val: string): boolean {
  return /^(hash-)?[a-fA-F0-9]{64}$/.test(val);
}
