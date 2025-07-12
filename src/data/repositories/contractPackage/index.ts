import {
  CasperWalletApiUrl,
  ContractPackageError,
  ContractPackageErrorType,
  CSPR_API_PROXY_HEADERS,
  DataResponse,
  IContractPackageRepository,
  IGetContractPackageParams,
  IHttpDataProvider,
  isContractPackageError,
} from '../../../domain';
import { IContractPackageCloudResponse } from './types';
import { ContractPackageDto } from '../../dto';

export * from './types';

export class ContractPackageRepository implements IContractPackageRepository {
  constructor(private _httpProvider: IHttpDataProvider) {}

  async getContractPackage({
    contractPackageHash,
    network,
    withProxyHeader = true,
  }: IGetContractPackageParams) {
    try {
      const resp = await this._httpProvider.get<DataResponse<IContractPackageCloudResponse>>({
        url: `${CasperWalletApiUrl[network]}/contract-packages/${contractPackageHash}`,
        baseURL: '',
        errorType: 'getContractPackageRequest',
        ...(withProxyHeader ? { headers: CSPR_API_PROXY_HEADERS } : {}),
      });

      return resp?.data ? new ContractPackageDto(resp.data) : null;
    } catch (e) {
      this._processError(e, 'getContractPackage');
    }
  }

  private _processError(e: unknown, type: ContractPackageErrorType): never {
    if (isContractPackageError(e)) {
      throw e;
    }

    throw new ContractPackageError(e, type);
  }
}
