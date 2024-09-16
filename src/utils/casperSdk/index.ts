import { CLPublicKey, CLValueBuilder, encodeBase16, RuntimeArgs } from 'casper-js-sdk';

import { IArgsForTransferCep47, IArgsForTransferNft } from './types';
import { NftStandard } from '../../domain';

// PublicKey casper nomenclature:
// - public key = base16 hex => algo prefix + public key hex
// - account hash - internal representation of a public key with a fixed length

// base16 hex: '01deba7173738a7f55de3ad9dc27e081df41ff285f25887ec424a8a65b43d0cf77'
// base64 "2qdt4zi/b/uagi2L9Y+db0I0Jt62CTpR/Td9HhiRAu0="

// ED = 01 public keys should be 66 chars long (with the prefix)
// SEC = 02 public keys should be 68 chars long (with the prefix)

export const getAccountHashFromPublicKey = (publicKey: string): string =>
  encodeBase16(CLPublicKey.fromFormattedString(publicKey).toAccountHash().data);

const getRuntimeArgsForCep78Transfer = (args: IArgsForTransferNft) => {
  const runtimeArgs = RuntimeArgs.fromMap({
    target_key: CLValueBuilder.key(args.target),
    source_key: CLValueBuilder.key(args.source),
  });

  if (args.tokenId) {
    runtimeArgs.insert('is_hash_identifier_mode', CLValueBuilder.bool(false));
    runtimeArgs.insert('token_id', CLValueBuilder.u64(args.tokenId));
  }

  if (args.tokenHash) {
    runtimeArgs.insert('is_hash_identifier_mode', CLValueBuilder.bool(true));
    runtimeArgs.insert('token_id', CLValueBuilder.u64(args.tokenHash));
  }

  return runtimeArgs;
};

const getRuntimeArgsForCep47Transfer = ({ target, ids }: IArgsForTransferCep47) =>
  RuntimeArgs.fromMap({
    recipient: CLValueBuilder.key(target),
    token_ids: CLValueBuilder.list(ids.map(id => CLValueBuilder.u256(id))),
  });

export const getRuntimeArgsForNftTransfer = (
  tokenStandard: NftStandard,
  args: IArgsForTransferNft,
) => {
  switch (tokenStandard) {
    case 'CEP47':
      return getRuntimeArgsForCep47Transfer({
        target: args.target,
        ids: [args.tokenId!],
      });
    case 'CEP78':
      return getRuntimeArgsForCep78Transfer({
        target: args.target,
        source: args.source,
        tokenId: args.tokenId,
      });

    default:
      throw new Error('Unknown token standard.');
  }
};
