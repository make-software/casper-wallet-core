import { useContext } from 'react';

import { ContractSettingsContext } from '../../providers/ContractSettingsProvider';

import type { IContractSettings } from '../../types';

export const useContractSettings = (): IContractSettings => {
  const context = useContext(ContractSettingsContext);

  if (!context) {
    throw new Error('useContractSettings must be used within a ContractSettingsProvider');
  }

  return context;
};
