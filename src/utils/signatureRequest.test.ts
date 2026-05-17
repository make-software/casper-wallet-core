import {
  isTxSignatureRequestAssociatedKeysAction,
  isTxSignatureRequestAuctionAction,
  isTxSignatureRequestCasperMarketAction,
  isTxSignatureRequestCep18Action,
  isTxSignatureRequestNativeCsprAction,
  isTxSignatureRequestNftAction,
  isTxSignatureRequestUnknownContractAction,
  isTxSignatureRequestWasmAction,
  isTxSignatureRequestWasmProxyAction,
} from './signatureRequest';
import type { ITxSignatureRequestActionUnion } from '../domain';

const action = (type: ITxSignatureRequestActionUnion['type']): ITxSignatureRequestActionUnion =>
  ({ type } as ITxSignatureRequestActionUnion);

describe('tx signature request action type guards', () => {
  it.each<[ITxSignatureRequestActionUnion['type'], (a: ITxSignatureRequestActionUnion) => boolean]>([
    ['AUCTION', isTxSignatureRequestAuctionAction],
    ['ASSOCIATED_KEYS', isTxSignatureRequestAssociatedKeysAction],
    ['CSPR_MARKET', isTxSignatureRequestCasperMarketAction],
    ['CEP18', isTxSignatureRequestCep18Action],
    ['CSPR_NATIVE', isTxSignatureRequestNativeCsprAction],
    ['NFT', isTxSignatureRequestNftAction],
    ['UNKNOWN', isTxSignatureRequestUnknownContractAction],
    ['WASM', isTxSignatureRequestWasmAction],
    ['WASM_PROXY', isTxSignatureRequestWasmProxyAction],
  ])('matches its own type (%s)', (type, guard) => {
    expect(guard(action(type))).toBe(true);
  });

  it('does not match a different type', () => {
    expect(isTxSignatureRequestCep18Action(action('AUCTION'))).toBe(false);
    expect(isTxSignatureRequestAuctionAction(action('CEP18'))).toBe(false);
    expect(isTxSignatureRequestNftAction(action('CSPR_NATIVE'))).toBe(false);
    expect(isTxSignatureRequestWasmAction(action('WASM_PROXY'))).toBe(false);
    expect(isTxSignatureRequestWasmProxyAction(action('WASM'))).toBe(false);
  });
});
