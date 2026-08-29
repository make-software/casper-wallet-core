import { mapCountriesWithFlags, OnRampDto, OnRampProvidersDto } from './onRamp';

describe('OnRampDto', () => {
  it('maps the full response shape', () => {
    const dto = new OnRampDto({
      countries: [{ name: 'United States', code: 'US' }],
      defaultCountry: 'US',
      currencies: [{ id: 'USD' } as never],
      defaultCurrency: 'USD',
      defaultAmount: '100',
    });

    expect(dto.countries).toHaveLength(1);
    expect(dto.countries[0]).toMatchObject({
      name: 'United States',
      code: 'US',
      flagUri: expect.stringContaining('us.svg'),
    });
    expect(dto.defaultCountry).toBe('US');
    expect(dto.defaultAmount).toBe('100');
  });

  it('maps currency type_id to typeId', () => {
    const dto = new OnRampDto({
      countries: [],
      defaultCountry: 'US',
      currencies: [{ id: 1, code: 'USD', type_id: 'fiat', rate: 1.5 }],
      defaultCurrency: 'USD',
      defaultAmount: '100',
    });

    expect(dto.currencies).toEqual([{ id: 1, code: 'USD', typeId: 'fiat', rate: 1.5 }]);
  });

  it('falls back to empty defaults', () => {
    const dto = new OnRampDto();
    expect(dto.countries).toEqual([]);
    expect(dto.defaultCountry).toBe('');
    expect(dto.defaultCurrency).toBe('');
    expect(dto.defaultAmount).toBe('');
  });
});

describe('OnRampProvidersDto', () => {
  it('maps the full response shape', () => {
    const dto = new OnRampProvidersDto({
      availableProviders: [{ name: 'p1' } as never],
      currencies: [{ id: 'USD' } as never],
      fiatAmount: 100,
      cryptoAmount: 1000,
      cryptoCurrency: 'CSPR',
      isCryptoChanged: true,
      fiatCurrency: 'USD',
    });

    expect(dto.availableProviders).toHaveLength(1);
    expect(dto.currency).toMatchObject({ id: 'USD' });
    expect(dto.fiatAmount).toBe(100);
    expect(dto.cryptoAmount).toBe(1000);
    expect(dto.isCryptoChanged).toBe(true);
    expect(dto.cryptoCurrency).toBe('CSPR');
  });

  it('maps the selected currency type_id to typeId', () => {
    const dto = new OnRampProvidersDto({
      availableProviders: [],
      currencies: [{ id: 1, code: 'USD', type_id: 'fiat', rate: 1.5 }],
      fiatAmount: 100,
      cryptoAmount: 1000,
      cryptoCurrency: 'CSPR',
      isCryptoChanged: false,
      fiatCurrency: 'USD',
    });

    expect(dto.currency).toEqual({ id: 1, code: 'USD', typeId: 'fiat', rate: 1.5 });
  });

  it('falls back to defaults', () => {
    const dto = new OnRampProvidersDto();
    expect(dto.availableProviders).toEqual([]);
    expect(dto.currency).toBeNull();
    expect(dto.fiatAmount).toBe(0);
    expect(dto.cryptoAmount).toBe(0);
    expect(dto.isCryptoChanged).toBe(false);
    expect(dto.cryptoCurrency).toBe('');
  });
});

describe('mapCountriesWithFlags', () => {
  it('returns empty array when undefined', () => {
    expect(mapCountriesWithFlags(undefined)).toEqual([]);
  });

  it('attaches lowercase-code flagUri', () => {
    expect(mapCountriesWithFlags([{ name: 'Canada', code: 'CA' }])).toEqual([
      { name: 'Canada', code: 'CA', flagUri: expect.stringContaining('ca.svg') },
    ]);
  });
});
