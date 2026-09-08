import { getTransactionErrorMessage } from '../../utils/swap';

import type { ILedgerEvent } from '../ledger';
import type { WrapFlowEvent } from './entities';
import type { ISwapLegState } from './swapReducer';

export interface IWrapFlowState {
  step: 'confirm' | 'signing' | 'success';
  wrap: ISwapLegState;
  ledgerEvent?: ILedgerEvent;
}

export const initialWrapFlowState: IWrapFlowState = {
  step: 'confirm',
  wrap: { status: 'idle' },
};

export const wrapFlowReducer = (state: IWrapFlowState, event: WrapFlowEvent): IWrapFlowState => {
  switch (event.type) {
    case 'wrap:signing':
      return { ...state, step: 'signing', wrap: { ...state.wrap, status: 'pending' } };
    case 'wrap:sent':
      return { ...state, wrap: { ...state.wrap, status: 'awaiting', hash: event.hash } };
    case 'wrap:confirmed':
      return { ...state, step: 'success', wrap: { ...state.wrap, status: 'success' } };
    case 'ledger':
      return { ...state, ledgerEvent: event.event };
    case 'cancelled':
      return { ...state, step: 'confirm', wrap: { ...state.wrap, status: 'idle' } };
    case 'failed':
      return {
        ...state,
        step: 'confirm',
        wrap: { ...state.wrap, status: 'error', error: getTransactionErrorMessage(event.error) },
      };
    default:
      return state;
  }
};
