import { CLKeyParameters } from 'casper-js-sdk';

export type IArgsForTransferCep47 = {
  target: CLKeyParameters;
  ids: string[];
};

export interface IArgsForTransferNft {
  tokenId?: string;
  tokenHash?: string;
  target: CLKeyParameters;
  source: CLKeyParameters;
}
