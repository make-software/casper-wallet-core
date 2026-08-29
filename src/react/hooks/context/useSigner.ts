import { useRepositories } from './useRepositories';

import type { ISigner } from '../../types';

export const useSigner = (): ISigner | null => {
  const { signer } = useRepositories();

  return signer;
};
