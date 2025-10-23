import { ITxSignatureRequest } from './entities';
import { IEnv } from '../env';

export interface ITxSignatureRequestRepository {
  prepareSignatureRequest(params: IPrepareSignatureRequestParams): Promise<ITxSignatureRequest>;
}

export interface IPrepareSignatureRequestParams {
  transactionJson: string;
  signingPublicKeyHex: string;
  withProxyHeader?: boolean;
  env?: IEnv;
}
