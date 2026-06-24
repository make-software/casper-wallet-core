import { PublicKey } from 'casper-js-sdk';
import { casperChainNameToCasperNetwork, CasperLiveUrl, CasperNetwork } from '../../domain';
import { Maybe } from '../../typings';

// PublicKey casper nomenclature:
// - public key = base16 hex => algo prefix + public key hex
// - account hash - internal representation of a public key with a fixed length

// base16 hex: '01deba7173738a7f55de3ad9dc27e081df41ff285f25887ec424a8a65b43d0cf77'
// base64 "2qdt4zi/b/uagi2L9Y+db0I0Jt62CTpR/Td9HhiRAu0="

// ED = 01 public keys should be 66 chars long (with the prefix)
// SEC = 02 public keys should be 68 chars long (with the prefix)

export const getAccountHashFromPublicKey = (publicKey: string): string =>
  PublicKey.fromHex(publicKey).accountHash().toHex();

const CASPER_NETWORKS = new Set<string>(['mainnet', 'testnet', 'devnet', 'integration']);

const isCasperNetwork = (value: string): value is CasperNetwork => CASPER_NETWORKS.has(value);

/** Accepts CasperNetwork and CasperNetworkName chainNames, incl. CAIP-2 (e.g. "casper:casper-test"). */
export const getCasperNetworkByChainName = (chainName: string): Maybe<CasperNetwork> => {
  // CAIP-2 (e.g. "casper:casper-test") — use the reference segment after the last ':'.
  const name = chainName.includes(':')
    ? chainName.slice(chainName.lastIndexOf(':') + 1)
    : chainName;

  if (isCasperNetwork(name)) {
    return name;
  }

  // Dynamic string lookup into a Record<CasperNetworkName, CasperNetwork>: widen the key type
  // instead of asserting `name` is a valid enum member.
  return (casperChainNameToCasperNetwork as Record<string, CasperNetwork>)[name] ?? null;
};

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

export * from './cep-nft-transfer';
