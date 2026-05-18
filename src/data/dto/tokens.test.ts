import { CsprBalanceDto, TokenDto, TokenFiatRateDto } from './tokens';
import {
  makeCsprBalanceResponse,
  makeCurrencyRateResponse,
  makeErc20Token,
} from '../../__test-utils__';
import { CSPR_DECIMALS } from '../../domain';

describe('TokenDto', () => {
  it('builds a token with decimal balance and fiat fields', () => {
    const apiToken = makeErc20Token();
    const dto = new TokenDto('mainnet', {
      ...apiToken.contract_package,
      balance: apiToken.balance,
    });

    expect(dto.network).toBe('mainnet');
    expect(dto.balance).toBe('10000000000');
    expect(dto.decimals).toBe(9);
    expect(dto.symbol).toBe('STK');
    expect(dto.decimalBalance).toBe('10');
    expect(dto.formattedDecimalBalance).toBe('10');
    expect(dto.isNative).toBe(false);
    expect(dto.currency).toBe('USD');
  });

  it('marks CSPR-symbol tokens as native', () => {
    const dto = new TokenDto('mainnet', {
      metadata: {
        decimals: 9,
        symbol: 'CSPR',
        name: 'CSPR',
        balances_uref: '',
        total_supply_uref: '',
      },
    });
    expect(dto.isNative).toBe(true);
  });

  it('handles missing market data', () => {
    const dto = new TokenDto('mainnet', { balance: '0' });
    expect(dto.fiatPrice).toBe(0);
    expect(dto.fiatBalance).toBe('');
    expect(dto.marketDataProvider).toBeNull();
    expect(dto.marketDataProviderUrl).toBeNull();
  });

  it('picks the lowest dex_id token_market_data entry', () => {
    const dto = new TokenDto('mainnet', {
      metadata: {
        decimals: 9,
        symbol: 'STK',
        name: 'STK',
        balances_uref: '',
        total_supply_uref: '',
      },
      balance: '1000000000',
      token_market_data: [
        // higher dex_id should be discarded by the sort
        { dex_id: 2, latest_rate: 0.5 } as never,
        { dex_id: 1, latest_rate: 1 } as never,
      ],
    });
    expect(dto.fiatPrice).toBe(1);
    expect(dto.marketDataProvider).toBe('CsprTrade');
  });
});

describe('CsprBalanceDto', () => {
  it('aggregates liquid + delegated + undelegating into total', () => {
    const dto = new CsprBalanceDto(makeCsprBalanceResponse());

    expect(dto.liquidBalance).toBe('1000000000000');
    expect(dto.delegatedBalance).toBe('500000000000');
    expect(dto.totalBalance).toBe('1500000000000');
    expect(dto.totalDecimalBalance).toBe('1500');
  });

  it('defaults all balances to zero when called with no input', () => {
    const dto = new CsprBalanceDto();
    expect(dto.liquidBalance).toBe('0');
    expect(dto.delegatedBalance).toBe('0');
    expect(dto.undelegatingBalance).toBe('0');
    expect(dto.totalBalance).toBe('0');
  });

  it('formats decimal balances with CSPR_DECIMALS (9)', () => {
    expect(CSPR_DECIMALS).toBe(9);
    const dto = new CsprBalanceDto({ balance: '1234500000' });
    expect(dto.liquidDecimalBalance).toBe('1.2345');
  });
});

describe('TokenFiatRateDto', () => {
  it('reads rate from data.amount', () => {
    const dto = new TokenFiatRateDto(makeCurrencyRateResponse(0.0123));
    expect(dto.rate).toBe(0.0123);
    expect(dto.currency).toBe('USD');
  });

  it('defaults to 0 when amount is missing', () => {
    expect(new TokenFiatRateDto().rate).toBe(0);
    expect(new TokenFiatRateDto({} as never).rate).toBe(0);
  });
});
