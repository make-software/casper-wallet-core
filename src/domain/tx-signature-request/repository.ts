import { ITxSignatureRequest } from './entities';

export interface ITxSignatureRequestRepository {
  prepareSignatureRequest(params: IPrepareSignatureRequestParams): Promise<ITxSignatureRequest>;
}

export interface IPrepareSignatureRequestParams {
  transactionJson: string;
  signingPublicKeyHex: string;
  withProxyHeader?: boolean;
}
