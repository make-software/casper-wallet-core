import { IEntity } from '../common';
import { Maybe } from '../../typings';

export interface INft extends IEntity {
  readonly tokenId: string;
  readonly trackingId: string;
  readonly standard: NftStandard;

  readonly contractPackageHash: string;
  readonly contactName: string;
  readonly owner_reverse_lookup_mode: boolean;

  readonly metadata: INftMetadata;
  readonly previewUrl: Maybe<string>;
  readonly proxyPreviewUrl: Maybe<string>;

  readonly timestamp: string;
}

export type NftStandard = 'CEP47' | 'CEP78';
/** audio/*, video/*, image/*, unknown */
export type NftContentType = string | 'unknown';

export interface INftMetadata {
  name?: string;
  description?: string;
  nftPreview?: string;
  contentIpfs?: string;
  pictureIpfs?: string;
}
