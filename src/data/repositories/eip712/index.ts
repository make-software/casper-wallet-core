import {
  EIP712Error,
  IEIP712Digest,
  IEIP712DisplayModel,
  IEIP712RecoverSignerParams,
  IEIP712Repository,
  IEIP712SignDigestParams,
  IEIP712SignResult,
  IEIP712SignTypedDataOptions,
  IEIP712SignTypedDataParams,
  IEIP712TypedData,
  IEIP712VerifySignatureParams,
  isEIP712Error,
} from '../../../domain';
import {
  buildTypedDataDisplayModel,
  computeTypedDataDigest,
  recoverTypedDataSignerAddress,
  signTypedData as signTypedDataUtil,
  signTypedDataDigestWithKey,
  verifyTypedDataSignature,
} from '../../../utils';

/**
 * Synchronous repository: EIP-712 work is pure CPU (validation, hashing, signing) with no network
 * or I/O, so — unlike the HTTP-backed repositories in this package — these methods are not async.
 *
 * `computeDigest`, `signDigest` and `signTypedData` wrap unexpected failures in {@link EIP712Error}.
 * `recoverSigner` and `verifySignature` are thin secp256k1 wrappers that surface raw library errors
 * as-is (they are not wrapped in EIP712Error).
 */
export class EIP712Repository implements IEIP712Repository {
  computeDigest(typedData: IEIP712TypedData, options?: IEIP712SignTypedDataOptions): IEIP712Digest {
    try {
      return computeTypedDataDigest(typedData, options);
    } catch (e) {
      throw isEIP712Error(e) ? e : new EIP712Error(e, 'computeDigest');
    }
  }

  buildDisplayModel(typedData: IEIP712TypedData): IEIP712DisplayModel {
    return buildTypedDataDisplayModel(typedData);
  }

  signDigest({ privateKey, digest }: IEIP712SignDigestParams): IEIP712SignResult {
    try {
      return signTypedDataDigestWithKey(privateKey, digest);
    } catch (e) {
      throw isEIP712Error(e) ? e : new EIP712Error(e, 'signDigest');
    }
  }

  signTypedData({ typedData, privateKey, options }: IEIP712SignTypedDataParams): IEIP712SignResult {
    try {
      return signTypedDataUtil(typedData, privateKey, options);
    } catch (e) {
      throw isEIP712Error(e) ? e : new EIP712Error(e, 'signTypedData');
    }
  }

  recoverSigner(params: IEIP712RecoverSignerParams): string {
    return recoverTypedDataSignerAddress(params);
  }

  verifySignature(params: IEIP712VerifySignatureParams): boolean {
    return verifyTypedDataSignature(params);
  }
}
