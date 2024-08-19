import {
  CasperApiUrl,
  DataResponse,
  IGetValidatorsParams,
  IGetValidatorsWithStakesParams,
  isValidatorsError,
  IValidator,
  IValidatorsRepository,
  ValidatorsError,
} from '../../../domain';
import type { IHttpDataProvider } from '../../../domain';
import { ValidatorDto, ValidatorWithStateDto } from '../../dto';
import { IApiValidator, IApiValidatorWithStake } from './types';

export * from './types';

export class ValidatorsRepository implements IValidatorsRepository {
  constructor(private _httpProvider: IHttpDataProvider) {}

  async getValidators({ network }: IGetValidatorsParams) {
    try {
      const validatorsList = await this._httpProvider.get<DataResponse<IApiValidator[]>>({
        url: `${CasperApiUrl[network]}/auction-validators`,
        params: {
          page: 1,
          limit: -1,
          fields: 'account_info,average_performance',
          is_active: true,
        },
        errorType: 'getValidators',
      });

      return (validatorsList?.data ?? []).map(apiValidator => {
        return new ValidatorDto(apiValidator);
      });
    } catch (e) {
      this._processError(e, 'getValidators');
    }
  }

  async getValidatorsWithStakes({
    network,
    publicKey,
  }: IGetValidatorsWithStakesParams): Promise<IValidator[]> {
    try {
      const validatorsList = await this._httpProvider.get<DataResponse<IApiValidatorWithStake[]>>({
        url: `${CasperApiUrl[network]}/accounts/${publicKey}/delegations`,
        params: {
          page: 1,
          limit: 100,
          fields: 'validator,validator_account_info',
        },
        errorType: 'getValidatorsWithStakes',
      });

      return (validatorsList?.data ?? []).map(apiValidator => {
        return new ValidatorWithStateDto(apiValidator);
      });
    } catch (e) {
      this._processError(e, 'getValidatorsWithStakes');
    }
  }

  private _processError(e: unknown, type: keyof IValidatorsRepository): never {
    if (isValidatorsError(e)) {
      throw e;
    }

    throw new ValidatorsError(e, type);
  }
}
