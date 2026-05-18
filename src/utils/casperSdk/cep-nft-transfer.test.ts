import {
  getRuntimeArgsForCep47Transfer,
  getRuntimeArgsForCep78Transfer,
  getRuntimeArgsForCep95Transfer,
  getRuntimeArgsForNftTransfer,
  makeNftTransferDeploy,
  makeNftTransferTransaction,
  NFTTokenStandard,
} from './cep-nft-transfer';

const SENDER = '0106956df3aba7115e28271d053205ec7f33cab259f8e2da2f38150f0ece65a2a8';
const RECIPIENT = '0156e1635c08f7d2818da256937f03062044e748067c73249fb898712bc76eceba';
const CONTRACT_PACKAGE_HASH = 'a'.repeat(64);

describe('cep-nft-transfer', () => {
  describe('getRuntimeArgsForNftTransfer', () => {
    it('throws when neither tokenId nor tokenHash provided', () => {
      expect(() =>
        getRuntimeArgsForNftTransfer({
          nftStandard: NFTTokenStandard.CEP47,
          senderPublicKeyHex: SENDER,
          recipientPublicKeyHex: RECIPIENT,
        }),
      ).toThrow(/Specify either tokenId or tokenHash/);
    });

    it('throws when CEP47 used without tokenId', () => {
      expect(() =>
        getRuntimeArgsForNftTransfer({
          nftStandard: NFTTokenStandard.CEP47,
          senderPublicKeyHex: SENDER,
          recipientPublicKeyHex: RECIPIENT,
          tokenHash: 'someHash',
        }),
      ).toThrow(/TokenId is required for CEP-47/);
    });

    it('returns args for CEP78 with tokenId', () => {
      const args = getRuntimeArgsForCep78Transfer({
        tokenId: '7',
        senderPublicKeyHex: SENDER,
        recipientPublicKeyHex: RECIPIENT,
      });
      expect(args).toBeDefined();
    });

    it('returns args for CEP47', () => {
      const args = getRuntimeArgsForCep47Transfer({
        tokenId: '7',
        recipientPublicKeyHex: RECIPIENT,
      });
      expect(args).toBeDefined();
    });

    it('returns args for CEP95', () => {
      const args = getRuntimeArgsForCep95Transfer({
        tokenId: '7',
        recipientPublicKeyHex: RECIPIENT,
        senderPublicKeyHex: SENDER,
      });
      expect(args).toBeDefined();
    });
  });

  describe('makeNftTransferDeploy', () => {
    it('builds a Deploy', () => {
      const deploy = makeNftTransferDeploy({
        nftStandard: NFTTokenStandard.CEP47,
        contractPackageHash: CONTRACT_PACKAGE_HASH,
        senderPublicKeyHex: SENDER,
        recipientPublicKeyHex: RECIPIENT,
        paymentAmount: '4000000000',
        tokenId: '7',
      });
      expect(deploy).toBeDefined();
    });

    it('applies an explicit timestamp', () => {
      const deploy = makeNftTransferDeploy({
        nftStandard: NFTTokenStandard.CEP47,
        contractPackageHash: CONTRACT_PACKAGE_HASH,
        senderPublicKeyHex: SENDER,
        recipientPublicKeyHex: RECIPIENT,
        paymentAmount: '4000000000',
        tokenId: '7',
        timestamp: '2024-01-15T10:30:00.000Z',
      });
      expect(deploy).toBeDefined();
    });
  });

  describe('makeNftTransferTransaction', () => {
    it('builds a Transaction for v1 (deploy-based)', () => {
      const txn = makeNftTransferTransaction({
        nftStandard: NFTTokenStandard.CEP47,
        contractPackageHash: CONTRACT_PACKAGE_HASH,
        senderPublicKeyHex: SENDER,
        recipientPublicKeyHex: RECIPIENT,
        paymentAmount: '4000000000',
        tokenId: '7',
        casperNetworkApiVersion: '1.5',
      });
      expect(txn).toBeDefined();
    });

    it('builds a Transaction for v2 (ContractCallBuilder)', () => {
      const txn = makeNftTransferTransaction({
        nftStandard: NFTTokenStandard.CEP47,
        contractPackageHash: CONTRACT_PACKAGE_HASH,
        senderPublicKeyHex: SENDER,
        recipientPublicKeyHex: RECIPIENT,
        paymentAmount: '4000000000',
        tokenId: '7',
        casperNetworkApiVersion: '2.0',
      });
      expect(txn).toBeDefined();
    });
  });
});
