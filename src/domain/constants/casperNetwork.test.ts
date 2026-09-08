import { CASPER_MESSAGE_HEADER, CSPR_COIN_INDEX } from './casperNetwork';

describe('casperTransactions constants', () => {
  it('message header and coin index are exact', () => {
    expect(CASPER_MESSAGE_HEADER).toBe('Casper Message:\n');
    expect(CSPR_COIN_INDEX).toBe(506);
  });
});
