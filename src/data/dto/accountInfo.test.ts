import { AccountsInfoDto } from './accountInfo';
import { makeAccountsInfoResponse } from '../../__test-utils__';
import { CasperLiveUrl } from '../../domain';

describe('AccountsInfoDto', () => {
  describe('fromGetAccountsInfoResponse', () => {
    it('builds a DTO with name, branding, csprName, explorerLink', () => {
      const dto = AccountsInfoDto.fromGetAccountsInfoResponse(
        'mainnet',
        makeAccountsInfoResponse(),
      );

      expect(dto.publicKey).toBeTruthy();
      expect(dto.accountHash).toBeTruthy();
      expect(dto.name).toBe('Alice');
      expect(dto.brandingLogo).toBe('https://example.com/logo.png');
      expect(dto.csprName).toBe('alice.cspr');
      expect(dto.explorerLink).toContain(CasperLiveUrl.mainnet);
    });

    it('falls back to centralized_account_info when account_info is missing', () => {
      const dto = AccountsInfoDto.fromGetAccountsInfoResponse(
        'mainnet',
        makeAccountsInfoResponse({
          account_info: undefined,
          centralized_account_info: {
            account_hash: 'a',
            avatar_url: 'https://cdn/avatar.png',
            name: 'CentralAlice',
            url: null,
          },
        }),
      );

      expect(dto.name).toBe('CentralAlice');
      expect(dto.brandingLogo).toBe('https://cdn/avatar.png');
    });

    it('returns empty defaults when input is missing', () => {
      const dto = AccountsInfoDto.fromGetAccountsInfoResponse('mainnet');
      expect(dto.publicKey).toBe('');
      expect(dto.accountHash).toBe('');
      expect(dto.name).toBe('');
      expect(dto.brandingLogo).toBeNull();
      expect(dto.csprName).toBeNull();
    });
  });

  describe('fromCsprNameResolution', () => {
    it('builds a DTO from a cspr-name resolution response', () => {
      const dto = AccountsInfoDto.fromCsprNameResolution('testnet', {
        resolved_public_key: '0202aa',
        resolved_hash: 'b'.repeat(64),
        name: 'bob.cspr',
        account_info: {
          info: { owner: { name: 'Bob', branding: { logo: { svg: 'svg-url' } } } },
        } as never,
        centralized_account_info: null,
        expires_at: '2099-01-01T00:00:00.000Z',
      });

      expect(dto.publicKey).toBe('0202aa');
      expect(dto.csprName).toBe('bob.cspr');
      expect(dto.brandingLogo).toBe('svg-url');
    });
  });

  describe('fromTransactionFeedCaller', () => {
    it('builds a DTO for a feed item caller', () => {
      const dto = AccountsInfoDto.fromTransactionFeedCaller('mainnet', {
        caller_public_key: '0202ee',
        caller_hash: 'd'.repeat(64),
        caller_cspr_name: 'caller.cspr',
        account_info: { info: { owner: { name: 'Caller' } } },
      } as never);

      expect(dto.publicKey).toBe('0202ee');
      expect(dto.name).toBe('Caller');
      expect(dto.csprName).toBe('caller.cspr');
    });
  });

  describe('fromTransactionActionResults', () => {
    it('returns from/to pair', () => {
      const [from, to] = AccountsInfoDto.fromTransactionActionResults('mainnet', {
        from_public_key: 'from-pk',
        to_public_key: 'to-pk',
        from_hash: 'from-hash',
        to_hash: 'to-hash',
      } as never);

      expect(from.publicKey).toBe('from-pk');
      expect(to.publicKey).toBe('to-pk');
      expect(from.accountHash).toBe('from-hash');
      expect(to.accountHash).toBe('to-hash');
    });
  });
});
