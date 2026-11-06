import { IEIP712TypedData } from '../../domain';
import { computeTypedDataEIP712Digest } from './digest';
import vectors from './__fixtures__/permit2-contract-vectors.json';

interface IVector {
  name: string;
  typedData: IEIP712TypedData;
  digest: string;
  typeHash?: string;
  domainSeparator?: string;
  source: string;
}

const entries = vectors as unknown as IVector[];

describe('Permit2 contract vectors', () => {
  it('covers both primary types the contract implements', () => {
    const primaryTypes = entries.map(entry => entry.typedData.primaryType);
    expect(primaryTypes).toEqual(expect.arrayContaining(['PermitTransferFrom', 'PermitSingle']));
  });

  describe.each(entries)('$name', entry => {
    const { digest, hashArtifacts } = computeTypedDataEIP712Digest(entry.typedData, {
      returnHashArtifacts: true,
    });

    it('matches the contract digest', () => {
      expect(digest).toBe(entry.digest);
    });

    it('matches the contract type hash', () => {
      expect(hashArtifacts?.typeHash).toBe(entry.typeHash);
    });

    it('matches the contract domain separator', () => {
      expect(hashArtifacts?.domainSeparator).toBe(entry.domainSeparator);
    });
  });
});
