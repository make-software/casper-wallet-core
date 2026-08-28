import { CasperLiveUrl } from '../../domain/constants/casperNetwork';
import { Maybe } from '../../typings';
import { getCasperNetworkByChainName } from './network';

/**
 * SDK-free cspr.live URL builders. As with `./network`, imports target specific domain modules
 * rather than the `../../domain` barrel.
 */

export const getBlockExplorerAccountUrl = (
  chainName: string,
  accountKey: Maybe<string>,
): Maybe<string> => {
  const network = getCasperNetworkByChainName(chainName);

  if (!(network && accountKey)) {
    return null;
  }

  const path = accountKey?.includes('uref') ? 'uref' : 'account';

  return `${CasperLiveUrl[network]}/${path}/${accountKey}`;
};

export const getBlockExplorerContractPackageUrl = (
  chainName: string,
  contractPackageHash: Maybe<string>,
  contractHash: Maybe<string>,
): Maybe<string> => {
  const network = getCasperNetworkByChainName(chainName);

  if (!(network && (contractPackageHash || contractHash))) {
    return null;
  }

  if (contractPackageHash) {
    return `${CasperLiveUrl[network]}/contract-package/${contractPackageHash}`;
  }

  return `${CasperLiveUrl[network]}/contract/${contractHash}`;
};

export const getBlockExplorerHashUrl = (chainName: string, hash: string): Maybe<string> => {
  const network = getCasperNetworkByChainName(chainName);

  if (!network) {
    return null;
  }

  return `${CasperLiveUrl[network]}/search/${hash}`;
};

export const getContractNftUrl = (
  chainName: string,
  collectionHash: Maybe<string>,
  tokenId: string,
) => {
  const network = getCasperNetworkByChainName(chainName);

  if (!(network && collectionHash && tokenId)) {
    return null;
  }

  return `${CasperLiveUrl[network]}/contracts/${collectionHash}/nfts/${tokenId}`;
};
