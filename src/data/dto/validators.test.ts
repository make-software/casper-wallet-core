import { ValidatorDto, ValidatorWithStateDto } from './validators';
import { makeApiValidator } from '../../__test-utils__';

describe('ValidatorDto', () => {
  it('builds with stake formatting and minimum delegation defaults', () => {
    const dto = new ValidatorDto(makeApiValidator());

    expect(dto.publicKey).toBeTruthy();
    expect(dto.name).toBe('ValidatorOne');
    expect(dto.totalStake).toBe('50000000000000');
    expect(dto.formattedTotalStake).toBe('50,000');
    expect(dto.minAmount).toBe('500000000000');
    expect(dto.stake).toBeNull();
  });

  it('falls back to formatted publicKey when no owner.name', () => {
    const dto = new ValidatorDto({
      ...makeApiValidator(),
      account_info: undefined,
    });
    expect(dto.name).toMatch(/\.{3}/);
  });

  it('marks isHighStakeValidator when network_share >= 5', () => {
    const dto = new ValidatorDto(makeApiValidator({ network_share: '7.5' }));
    expect(dto.isHighStakeValidator).toBe(true);
    expect(dto.formattedNetworkShare).toBe('7.5');
  });

  it('formats network share to null when missing', () => {
    const dto = new ValidatorDto(makeApiValidator({ network_share: undefined }));
    expect(dto.formattedNetworkShare).toBeNull();
  });
});

describe('ValidatorWithStateDto', () => {
  it('builds from IApiValidatorWithStake with stake calculations', () => {
    const dto = new ValidatorWithStateDto({
      stake: '1000000000000',
      bidder: {
        public_key: 'pk',
        total_stake: 50_000_000_000_000,
        fee: 100,
        delegators_number: 2,
        network_share: '8',
      } as never,
      validator_account_info: { info: { owner: { name: 'V2' } } } as never,
    });

    expect(dto.publicKey).toBe('pk');
    expect(dto.name).toBe('V2');
    expect(dto.stake).toBe('1000000000000');
    expect(dto.decimalStake).toBe('1000');
    expect(dto.formattedDecimalStake).toBe('1,000');
    expect(dto.isHighStakeValidator).toBe(true);
  });
});
