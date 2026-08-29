import { useContext } from 'react';

import { RepositoriesContext } from '../../providers/RepositoriesProvider';

import type { IRepositoriesContextValue } from '../../types';

export const useRepositories = (): IRepositoriesContextValue => {
  const context = useContext(RepositoriesContext);

  if (!context) {
    throw new Error('useRepositories must be used within a RepositoriesProvider');
  }

  return context;
};
