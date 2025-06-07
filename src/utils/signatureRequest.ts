import {
  ITxSignatureRequestActionUnion,
  ITxSignatureRequestAssociatedKeysAction,
  ITxSignatureRequestAuctionAction,
  ITxSignatureRequestCasperMarketAction,
  ITxSignatureRequestCep18Action,
  ITxSignatureRequestNativeCsprAction,
  ITxSignatureRequestNFTAction,
  ITxSignatureRequestUnknownContractAction,
  ITxSignatureRequestWasmAction,
  ITxSignatureRequestWasmProxyAction,
} from '../domain';

export const isTxSignatureRequestAuctionAction = (
  action: ITxSignatureRequestActionUnion,
): action is ITxSignatureRequestAuctionAction => {
  return action.type === 'AUCTION';
};

export const isTxSignatureRequestAssociatedKeysAction = (
  action: ITxSignatureRequestActionUnion,
): action is ITxSignatureRequestAssociatedKeysAction => {
  return action.type === 'ASSOCIATED_KEYS';
};

export const isTxSignatureRequestCasperMarketAction = (
  action: ITxSignatureRequestActionUnion,
): action is ITxSignatureRequestCasperMarketAction => {
  return action.type === 'CSPR_MARKET';
};

export const isTxSignatureRequestCep18Action = (
  action: ITxSignatureRequestActionUnion,
): action is ITxSignatureRequestCep18Action => {
  return action.type === 'CEP18';
};

export const isTxSignatureRequestNativeCsprAction = (
  action: ITxSignatureRequestActionUnion,
): action is ITxSignatureRequestNativeCsprAction => {
  return action.type === 'CSPR_NATIVE';
};

export const isTxSignatureRequestNftAction = (
  action: ITxSignatureRequestActionUnion,
): action is ITxSignatureRequestNFTAction => {
  return action.type === 'NFT';
};

export const isTxSignatureRequestUnknownContractAction = (
  action: ITxSignatureRequestActionUnion,
): action is ITxSignatureRequestUnknownContractAction => {
  return action.type === 'UNKNOWN';
};

export const isTxSignatureRequestWasmAction = (
  action: ITxSignatureRequestActionUnion,
): action is ITxSignatureRequestWasmAction => {
  return action.type === 'WASM';
};

export const isTxSignatureRequestWasmProxyAction = (
  action: ITxSignatureRequestActionUnion,
): action is ITxSignatureRequestWasmProxyAction => {
  return action.type === 'WASM_PROXY';
};
