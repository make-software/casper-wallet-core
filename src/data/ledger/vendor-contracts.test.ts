import type Transport from '@ledgerhq/hw-transport';
import type CasperApp from '@zondax/ledger-casper';

import type { ILedgerCasperApp, ILedgerTransport } from '../../domain';

/**
 * `ILedgerTransport` and `ILedgerCasperApp` are declared by hand so the vendor packages stay
 * optional peers, out of the library's import graph. Nothing else checks that the hand-written
 * shapes still match what the apps actually inject — these assignments do, at compile time.
 */
describe('vendor Ledger contracts', () => {
  it('are satisfied by the packages the apps inject', () => {
    const transport: ILedgerTransport = {} as Transport;
    const app: ILedgerCasperApp = {} as CasperApp;

    expect([transport, app]).toHaveLength(2);
  });
});
