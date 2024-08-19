import { getUniqueId } from '../../utils';
import {
  CACHE_TTL,
  IMAGE_WIDTH,
  INft,
  INftMetadata,
  NftStandard,
  RETINA_SCALE,
} from '../../domain';
import { IApiNft, ImageProxyUrlProps, NFtMetadataEntry } from '../repositories';
import { Maybe } from '../../typings';

export class NftDto implements INft {
  constructor(apiNft?: Partial<IApiNft>) {
    this.id = apiNft?.contract_package_hash
      ? `${apiNft?.contract_package_hash}${apiNft?.token_id}`
      : getUniqueId();
    this.tokenId = apiNft?.token_id ?? '';
    this.trackingId = apiNft?.tracking_id ?? '';
    this.standard = mapNftStandard[apiNft?.token_standard_id ?? 1];
    this.contractPackageHash = apiNft?.contract_package_hash ?? '';
    this.contactName = apiNft?.contract_package?.name ?? '';
    this.owner_reverse_lookup_mode = Boolean(
      apiNft?.contract_package?.metadata?.owner_reverse_lookup_mode ?? false,
    );
    this.timestamp = apiNft?.timestamp ?? '';
    const metadataEntries = getNftTokenMetadataWithLinks(apiNft);
    this.metadata = Object.fromEntries(metadataEntries);
    this.previewUrl = getPreviewUrl(metadataEntries);
    this.proxyPreviewUrl = getImageProxyUrl(this.previewUrl);
  }

  id: string;
  tokenId: string;
  trackingId: string;
  standard: NftStandard;
  contractPackageHash: string;
  contactName: string;
  owner_reverse_lookup_mode: boolean;
  timestamp: string;
  metadata: INftMetadata;
  previewUrl: Maybe<string>;
  proxyPreviewUrl: Maybe<string>;
}

export const stringifyEntryValue = ([key, value]: [
  key: string,
  value: unknown,
]): NFtMetadataEntry => {
  return [key.trim(), typeof value === 'string' ? value : JSON.stringify(value)];
};

export const convertIpfsSourceAsLink = ([key, value]: NFtMetadataEntry): NFtMetadataEntry => {
  const isIpfsKey = new RegExp('ipfs', 'gi').test(key);
  const isIpfsValue = new RegExp('ipfs://', 'gi').test(value);
  const isLinkValue = new RegExp('http://|https://', 'gi').test(value);

  const getValue = () => {
    if (isIpfsValue) {
      return value.replace('ipfs://', 'https://ipfs.io/ipfs/');
    }

    if (isIpfsKey) {
      return isLinkValue ? value : 'https://ipfs.io/ipfs/' + value;
    }

    return value;
  };

  return [key, getValue()];
};

export const getNonObjectsEntryValue = ([, value]: NFtMetadataEntry) => {
  try {
    const parsed = JSON.parse(value);

    return !(parsed && typeof parsed === 'object');
  } catch (e) {
    return true;
  }
};

export const getNftTokenMetadataWithLinks = (nftToken?: Maybe<Partial<IApiNft>>) => {
  if (!nftToken) {
    return [];
  }

  const onChain = nftToken?.onchain_metadata ?? {};
  const offChain = nftToken?.offchain_metadata ?? {};

  // Order here is important
  return [...Object.entries(offChain), ...Object.entries(onChain)]
    .map(stringifyEntryValue)
    .map(convertIpfsSourceAsLink)
    .filter(getNonObjectsEntryValue);
};

export const findMediaPreview = ([key, value]: NFtMetadataEntry): boolean => {
  const hasImageExtension = new RegExp(/\w+\.(jpg|jpeg|png|svg|gif)/, 'gi').test(value);
  const knownImageKey = new RegExp(
    'pictureIpfs|image|imageUrl|image_url|asset|ipfs_url|token_uri',
    'gi',
  ).test(key);

  return hasImageExtension || knownImageKey;
};

export const getImageProxyUrl = (
  url?: Maybe<string>,
  { ttl, width }: ImageProxyUrlProps = {
    ttl: CACHE_TTL,
    width: IMAGE_WIDTH * RETINA_SCALE,
  },
) => {
  if (!url) {
    return null;
  }

  return `https://image-proxy-cdn.make.services/${width},fit,ttl${ttl}/${url}`;
};

const getPreviewUrl = (nftTokenMetadataWithLinks?: NFtMetadataEntry[]) =>
  nftTokenMetadataWithLinks?.find(findMediaPreview)?.[1] ?? null;

export const NFTTokenStandards = {
  CEP47: 1,
  CEP78: 2,
};

export const mapNftStandard: Record<number, NftStandard> = {
  [NFTTokenStandards.CEP47]: 'CEP47',
  [NFTTokenStandards.CEP78]: 'CEP78',
};
