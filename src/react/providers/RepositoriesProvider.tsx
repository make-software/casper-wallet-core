import React, { createContext } from 'react';

import type { IRepositoriesContextValue } from '../types';

export const RepositoriesContext = createContext<IRepositoriesContextValue | null>(null);

export const RepositoriesProvider: React.FC<
  React.PropsWithChildren<{ value: IRepositoriesContextValue }>
> = ({ children, value }) => (
  <RepositoriesContext.Provider value={value}>{children}</RepositoriesContext.Provider>
);
