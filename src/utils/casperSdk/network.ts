import { casperChainNameToCasperNetwork } from '../../domain/constants/casperNetwork';
import { CasperNetwork } from '../../domain/common/common';
import { Maybe } from '../../typings';

/**
 * SDK-free chain-name resolution. Imports reach into the specific domain modules rather than the
 * `../../domain` barrel so that consumers on the wallet startup path do not link anything they do
 * not use — see the module comment in `./accountHash`.
 */

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
