import {
  DEFAULT_PAGE_LIMIT,
  EMPTY_PAGINATED_RESPONSE,
  CSPR_API_PROXY_HEADERS,
  isNftsError,
  NftsError,
  INftsRepository,
  IGetNftsParams,
  CloudPaginatedResponse,
  INft,
  NftContentType,
  PaginatedResponse,
  CasperNetwork,
} from '../../../domain';
import type { IHttpDataProvider } from '../../../domain';
import { getAccountHashFromPublicKey } from '../../../utils';
import { NftDto } from '../../dto';
import { IApiNft } from './types';

export * from './types';

export class NftsRepository implements INftsRepository {
  constructor(
    private _httpProvider: IHttpDataProvider,
    private _casperWalletApiUrl: Record<CasperNetwork, string>,
  ) {}

  async getNfts({
    network,
    publicKey,
    page,
    limit = DEFAULT_PAGE_LIMIT,
    withProxyHeader = true,
  }: IGetNftsParams): Promise<PaginatedResponse<INft>> {
    try {
      const accountHash = getAccountHashFromPublicKey(publicKey);

      const resp = await this._httpProvider.get<CloudPaginatedResponse<IApiNft>>({
        url: `${this._casperWalletApiUrl[network]}/accounts/${accountHash}/nft-tokens`,
        params: {
          page,
          page_size: limit,
          is_burned: false,
          includes: 'contract_package',
        },
        ...(withProxyHeader ? { headers: CSPR_API_PROXY_HEADERS } : {}),
        errorType: 'getNfts',
      });

      if (!resp) {
        return EMPTY_PAGINATED_RESPONSE;
      }

      return {
        itemCount: resp.item_count,
        pageCount: resp.page_count,
        pages: resp.pages,
        data: (resp?.data ?? []).map(nft => new NftDto(nft)),
      };
    } catch (e) {
      this._processError(e, 'getNfts');
    }
  }

  async deriveNftMediaType(url: string, withProxyHeader = true): Promise<NftContentType> {
    try {
      const headers = await this._httpProvider.head({
        url,
        ...(withProxyHeader ? { headers: CSPR_API_PROXY_HEADERS } : {}),
        errorType: 'deriveNftMediaType',
      });

      const type = headers?.['content-type'] ?? headers?.['Content-Type'];

      if (!type) {
        return 'unknown';
      }

      const isKnownType = /^(image|video|audio)/.test(type);

      return isKnownType ? type : 'unknown';
    } catch {
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
