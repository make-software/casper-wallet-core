import { Cep18TransferDeployDto } from './Cep18transferDeployDto';
import { CsprTransferDeployDto } from './CsprTransferDeployDto';

const ACTIVE_KEY = '0106956df3aba7115e28271d053205ec7f33cab259f8e2da2f38150f0ece65a2a8';

describe('CsprTransferDeployDto', () => {
  it('builds a CSPR_NATIVE deploy with defaults', () => {
    const dto = new CsprTransferDeployDto(ACTIVE_KEY);
    expect(dto.type).toBe('CSPR_NATIVE');
    expect(dto.executionTypeId).toBe(6);
    expect(dto.status).toBe('success');
    expect(dto.symbol).toBe('CSPR');
    expect(dto.amount).toBe('0');
    expect(dto.isReceive).toBe(false);
  });

  it('marks isReceive when active key matches to_public_key', () => {
    const dto = new CsprTransferDeployDto(ACTIVE_KEY, {
      to_public_key: ACTIVE_KEY,
      amount: '1000000000',
      timestamp: '2024-01-01T00:00:00.000Z',
    } as never);

    expect(dto.isReceive).toBe(true);
    expect(dto.recipientKey).toBe(ACTIVE_KEY);
    expect(dto.decimalAmount).toBe('1');
  });
});

describe('Cep18TransferDeployDto', () => {
  it('builds a CEP18 transfer with defaults', () => {
    const dto = new Cep18TransferDeployDto(ACTIVE_KEY);
    expect(dto.type).toBe('CEP18');
    expect(dto.status).toBe('success');
    expect(dto.amount).toBe('0');
    expect(dto.executionTypeId).toBe(1);
    expect(dto.entryPoint).toBe('transfer'); // default action_type_id=2
  });

  it('maps recipient + decimals + amount', () => {
    const dto = new Cep18TransferDeployDto(ACTIVE_KEY, {
      to_public_key: ACTIVE_KEY,
      amount: '1000',
      contract_package: {
        contract_package_hash: 'cph',
        name: 'TokenZ',
        icon_url: null,
        metadata: { symbol: 'TZ', decimals: 3 },
      } as never,
      erc20_action_type_id: 1,
      timestamp: '2024-01-01T00:00:00.000Z',
    } as never);

    expect(dto.isReceive).toBe(true);
    expect(dto.symbol).toBe('TZ');
    expect(dto.decimals).toBe(3);
    expect(dto.decimalAmount).toBe('1');
    expect(dto.entryPoint).toBe('mint');
  });
});
