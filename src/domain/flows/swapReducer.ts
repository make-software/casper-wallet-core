import { getTransactionErrorMessage } from '../../utils/swap';

import type { ILedgerEvent } from '../ledger';
import type { SwapFlowEvent, TransactionStatus } from './entities';

export interface ISwapLegState {
  status: TransactionStatus;
  hash?: string;
  error?: string;
}

export interface ISwapFlowState {
  step: 'confirm' | 'signing' | 'success';
  approval: ISwapLegState & { isRequired: boolean };
  swap: ISwapLegState;
  ledgerEvent?: ILedgerEvent;
}

export const initialSwapFlowState: ISwapFlowState = {
  step: 'confirm',
  approval: { isRequired: false, status: 'idle' },
  swap: { status: 'idle' },
};

export const swapFlowReducer = (state: ISwapFlowState, event: SwapFlowEvent): ISwapFlowState => {
  switch (event.type) {
    case 'approval:checking':
      return { ...state, step: 'signing', approval: { ...state.approval, status: 'pending' } };
    case 'approval:not-required':
      return { ...state, approval: { ...state.approval, isRequired: false, status: 'success' } };
    case 'approval:signing':
      return { ...state, approval: { ...state.approval, isRequired: true, status: 'pending' } };
    case 'approval:sent':
      return {
        ...state,
        approval: { ...state.approval, isRequired: true, status: 'awaiting', hash: event.hash },
      };
    case 'approval:confirmed':
      return { ...state, approval: { ...state.approval, status: 'success' } };
    case 'swap:signing':
      return { ...state, step: 'signing', swap: { ...state.swap, status: 'pending' } };
    case 'swap:sent':
      return { ...state, swap: { ...state.swap, status: 'awaiting', hash: event.hash } };
    case 'swap:confirmed':
      return { ...state, step: 'success', swap: { ...state.swap, status: 'success' } };
    case 'ledger':
      return { ...state, ledgerEvent: event.event };
    case 'cancelled':
      return {
        ...state,
        step: 'confirm',
        [event.leg]: { ...state[event.leg], status: 'idle' },
      } as ISwapFlowState;
    case 'failed':
      return {
        ...state,
        step: 'confirm',
        [event.leg]: {
          ...state[event.leg],
          status: 'error',
          error: getTransactionErrorMessage(event.error),
        },
      } as ISwapFlowState;
    default:
      return state;
  }
};
