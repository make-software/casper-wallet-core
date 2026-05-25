import {
  getCep18ActionsResult,
  getNftActionsResult,
  getTransferActionsResult,
} from './ActionResults';

const PUBLIC_KEY = '0106956df3aba7115e28271d053205ec7f33cab259f8e2da2f38150f0ece65a2a8';

describe('getCep18ActionsResult', () => {
  it('returns [] when no ft_token_actions', () => {
    expect(getCep18ActionsResult(PUBLIC_KEY, {})).toEqual([]);
    expect(getCep18ActionsResult(PUBLIC_KEY)).toEqual([]);
  });

  it('maps action with derived recipient and isReceive=true when recipient matches active key', () => {
    const out = getCep18ActionsResult(PUBLIC_KEY, {
      ft_token_actions: [
        {
          to_public_key: PUBLIC_KEY,
          from_public_key: 'sender',
          amount: '1000000000',
          contract_package_hash: 'cph',
          contract_package: {
            name: 'Token',
            icon_url: null,
            metadata: { symbol: 'STK', decimals: 9 },
          },
          ft_action_type_id: 2,
          timestamp: '2024-01-01T00:00:00.000Z',
        } as never,
      ],
    });

    expect(out).toHaveLength(1);
    expect(out[0].isReceive).toBe(true);
    expect(out[0].entryPoint).toBe('transfer');
    expect(out[0].symbol).toBe('STK');
    expect(out[0].decimalAmount).toBe('1');
  });
});

describe('getNftActionsResult', () => {
  it('returns [] when no nft_token_actions', () => {
    expect(getNftActionsResult(PUBLIC_KEY, 'mainnet', 'collection', {})).toEqual([]);
  });

  it('maps action to NFT result', () => {
    const out = getNftActionsResult(PUBLIC_KEY, 'mainnet', 'collection', {
      nft_token_actions: [
        {
          to_public_key: PUBLIC_KEY,
          from_public_key: 'sender',
          token_id: '1',
          contract_package_hash: 'cph',
          contract_package: { name: 'CC' } as never,
          nft_action_id: 4,
          timestamp: '2024-01-01T00:00:00.000Z',
        } as never,
      ],
    });

    expect(out).toHaveLength(1);
    expect(out[0].entryPoint).toBe('transfer');
    expect(out[0].isReceive).toBe(true);
  });
});

describe('getTransferActionsResult', () => {
  it('returns [] when no transfers', () => {
    expect(getTransferActionsResult(PUBLIC_KEY, {})).toEqual([]);
  });

  it('maps transfer to a TransferActionsResult', () => {
    const out = getTransferActionsResult(PUBLIC_KEY, {
      transfers: [
        {
          amount: '1000000000',
          from_purse_public_key: 'sender',
          to_purse_public_key: PUBLIC_KEY,
          timestamp: '2024-01-01T00:00:00.000Z',
          transfer_index: 0,
        } as never,
      ],
    });

    expect(out).toHaveLength(1);
    expect(out[0].isReceive).toBe(true);
  });
});
