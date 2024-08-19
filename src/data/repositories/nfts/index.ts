import {
  CasperApiUrl,
  DEFAULT_PAGE_LIMIT,
  EMPTY_PAGINATED_RESPONSE,
  CSPR_API_PROXY_HEADERS,
  isNftsError,
  NftsError,
  INftsRepository,
  IGetNftsParams,
  PaginatedResponse,
  INft,
  NftContentType,
} from '../../../domain';
import type { IHttpDataProvider } from '../../../domain';
import { getAccountHashFromPublicKey } from '../../../utils';
import { NftDto } from '../../dto';
import { IApiNft } from './types';

export * from './types';

export class NftsRepository implements INftsRepository {
  constructor(private _httpProvider: IHttpDataProvider) {}

  async getNfts({
    network,
    publicKey,
    page,
    limit = DEFAULT_PAGE_LIMIT,
  }: IGetNftsParams): Promise<PaginatedResponse<INft>> {
    try {
      const accountHash = getAccountHashFromPublicKey(publicKey);

      const resp = await this._httpProvider.get<PaginatedResponse<IApiNft>>({
        url: `${CasperApiUrl[network]}/accounts/${accountHash}/nft-tokens`,
        params: {
          page,
          limit,
          fields: 'contract_package',
        },
        errorType: 'getNfts',
      });

      if (!resp) {
        return EMPTY_PAGINATED_RESPONSE;
      }

      return {
        ...resp,
        data: (resp?.data ?? []).map(nft => new NftDto(nft)),
      };
    } catch (e) {
      this._processError(e, 'getNfts');
    }
  }

  async deriveNftMediaType(url: string): Promise<NftContentType> {
    try {
      const headers = await this._httpProvider.head({
        url,
        headers: CSPR_API_PROXY_HEADERS,
        errorType: 'deriveNftMediaType',
      });

      const type = headers?.['content-type'] ?? headers?.['Content-Type'];

      if (!type) {
        return 'unknown';
      }

      const isKnownType = /^(image|video|audio)/.test(type);

      return isKnownType ? type : 'unknown';
    } catch (e) {
      return 'unknown';
    }
  }

  private _processError(e: unknown, type: keyof INftsRepository): never {
    if (isNftsError(e)) {
      throw e;
    }

    throw new NftsError(e, type);
  }
}
