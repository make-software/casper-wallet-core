import {
  convertIpfsSourceAsLink,
  findMediaPreview,
  getImageProxyUrl,
  getNftTokenMetadataWithLinks,
  getNonObjectsEntryValue,
  mapNftStandard,
  NFTTokenStandards,
  NftDto,
  stringifyEntryValue,
} from './nfts';
import { makeApiNft } from '../../__test-utils__';

describe('NftDto', () => {
  it('builds a DTO with id, tokenIdType, standard, metadata', () => {
    const dto = new NftDto(makeApiNft());

    expect(dto.id).toContain('cph_');
    expect(dto.tokenId).toBe('1');
    expect(dto.tokenIdType).toBe('uint');
    expect(dto.standard).toBe('CEP78');
    expect(dto.metadata).toMatchObject({ name: 'Cool NFT' });
    expect(dto.previewUrl).toBe('https://example.com/nft.png');
    expect(dto.proxyPreviewUrl).toContain('image-proxy-cdn');
  });

  it('uses uniqueId when no contract_package_hash present', () => {
    const dto = new NftDto({});
    expect(dto.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('tokenIdType = hash when identifier_mode === 1', () => {
    const base = makeApiNft();
    const dto = new NftDto(
      makeApiNft({
        contract_package: {
          ...(base.contract_package as unknown as Record<string, unknown>),
          metadata: { identifier_mode: 1 },
        } as never,
      } as never),
    );
    expect(dto.tokenIdType).toBe('hash');
  });

  it('handles empty metadata', () => {
    const dto = new NftDto({});
    expect(dto.metadata).toEqual({});
    expect(dto.previewUrl).toBeNull();
    expect(dto.proxyPreviewUrl).toBeNull();
  });
});

describe('mapNftStandard', () => {
  it('maps the standard ids to names', () => {
    expect(mapNftStandard[NFTTokenStandards.CEP47]).toBe('CEP47');
    expect(mapNftStandard[NFTTokenStandards.CEP78]).toBe('CEP78');
    expect(mapNftStandard[NFTTokenStandards.CEP95]).toBe('CEP95');
  });
});

describe('stringifyEntryValue', () => {
  it('passes strings through trimmed key', () => {
    expect(stringifyEntryValue(['  key  ', 'value'])).toEqual(['key', 'value']);
  });

  it('JSON-stringifies non-strings', () => {
    expect(stringifyEntryValue(['k', { nested: true }])).toEqual(['k', '{"nested":true}']);
  });
});

describe('convertIpfsSourceAsLink', () => {
  it('replaces ipfs:// prefix with HTTPS gateway', () => {
    expect(convertIpfsSourceAsLink(['url', 'ipfs://abc'])).toEqual([
      'url',
      'https://ipfs.io/ipfs/abc',
    ]);
  });

  it('prefixes bare values when key contains "ipfs"', () => {
    expect(convertIpfsSourceAsLink(['ipfs_hash', 'abc'])).toEqual([
      'ipfs_hash',
      'https://ipfs.io/ipfs/abc',
    ]);
  });

  it('leaves http links alone', () => {
    expect(convertIpfsSourceAsLink(['k', 'https://e.com'])).toEqual(['k', 'https://e.com']);
  });
});

describe('getNonObjectsEntryValue', () => {
  it('keeps non-JSON strings', () => {
    expect(getNonObjectsEntryValue(['k', 'plain'])).toBe(true);
  });

  it('drops entries whose value parses to an object', () => {
    expect(getNonObjectsEntryValue(['k', '{"a":1}'])).toBe(false);
  });

  it('keeps numbers and primitives', () => {
    expect(getNonObjectsEntryValue(['k', '42'])).toBe(true);
  });
});

describe('findMediaPreview', () => {
  it.each([
    ['image', 'anything'],
    ['url', 'cat.png'],
    ['imageUrl', 'whatever'],
    ['random', 'kitten.jpeg'],
  ])('matches known keys/values: (%s, %s)', (k, v) => {
    expect(findMediaPreview([k, v])).toBe(true);
  });

  it('returns false for unrelated entries', () => {
    expect(findMediaPreview(['description', 'a cool nft'])).toBe(false);
  });
});

describe('getNftTokenMetadataWithLinks', () => {
  it('returns empty array for missing input', () => {
    expect(getNftTokenMetadataWithLinks(null)).toEqual([]);
  });

  it('combines on-chain and off-chain metadata, deduplicating objects', () => {
    const entries = getNftTokenMetadataWithLinks(makeApiNft());
    expect(entries.find(([k]) => k === 'name')?.[1]).toBe('Cool NFT');
  });
});

describe('getImageProxyUrl', () => {
  it('returns null for missing url', () => {
    expect(getImageProxyUrl(undefined)).toBeNull();
  });

  it('builds the proxy url', () => {
    expect(getImageProxyUrl('https://e.com/x.png')).toMatch(/image-proxy-cdn\.make\.services/);
  });
});
