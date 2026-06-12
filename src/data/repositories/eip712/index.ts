import {
  EIP712ContractEnrichmentStatus,
  EIP712EnrichmentStatus,
  EIP712Error,
  IAccountInfo,
  IAccountInfoRepository,
  IContractPackage,
  IContractPackageRepository,
  IEIP712Digest,
  IEIP712DisplayModel,
  IEIP712RecoverSignerParams,
  IEIP712Repository,
  IEIP712SignatureRequest,
  IEIP712SignDigestParams,
  IEIP712SignResult,
  IEIP712SignTypedDataOptions,
  IEIP712SignTypedDataParams,
  IEIP712TypedData,
  IEIP712VerifySignatureParams,
  ILogger,
  IPrepareEIP712SignatureRequestParams,
  isEIP712Error,
} from '../../../domain';
import { Maybe } from '../../../typings';
import {
  buildTypedDataDisplayModel,
  computeTypedDataDigest,
  getCasperNetworkByChainName,
  recoverTypedDataSignerAddress,
  signTypedData as signTypedDataUtil,
  signTypedDataDigestWithKey,
  verifyTypedDataSignature,
} from '../../../utils';
import {
  EIP712SignatureRequestDto,
  getAccountHashesFromTypedData,
  stripHexPrefix,
} from '../../dto';

/**
 * `prepareSignatureRequest` is asynchronous: it enriches the typed data with account info and
 * contract-package data over HTTP (best-effort — each lookup is isolated in its own try/catch, so a
 * flaky API never breaks the request). The other methods are synchronous pure-CPU work.
 *
 * `computeDigest`, `signDigest` and `signTypedData` wrap unexpected failures in {@link EIP712Error}.
 * `prepareSignatureRequest` surfaces digest/validation failures as {@link EIP712Error} (via
 * `computeDigest`) and swallows enrichment-lookup failures (best-effort). `recoverSigner` and
 * `verifySignature` surface raw library errors.
 */
export class EIP712Repository implements IEIP712Repository {
  constructor(
    private _accountInfoRepository: IAccountInfoRepository,
    private _contractPackageRepository: IContractPackageRepository,
    private _logger: ILogger,
  ) {}

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

  async prepareSignatureRequest({
    typedData,
    signingPublicKeyHex,
    network: networkParam,
    options,
    withProxyHeader = true,
  }: IPrepareEIP712SignatureRequestParams): Promise<IEIP712SignatureRequest> {
    const { digest, hashArtifacts } = this.computeDigest(typedData, options);

    const network =
      getCasperNetworkByChainName(String(typedData.domain.chain_name ?? '')) ??
      networkParam ??
      null;

    let accountInfoMap: Record<string, IAccountInfo> = {};
    let contractPackage: Maybe<IContractPackage> = null;
    let accounts: EIP712EnrichmentStatus = 'skipped';
    let contractPackageStatus: EIP712ContractEnrichmentStatus = 'skipped';

    if (network) {
      // Pure-CPU; kept outside the try so a bug here surfaces instead of being mislabeled API flakiness.
      const accountHashes = getAccountHashesFromTypedData(typedData, signingPublicKeyHex);
      try {
        accountInfoMap = await this._accountInfoRepository.getAccountsInfo({
          accountHashes,
          network,
          withProxyHeader,
        });
        accounts = 'ok';
      } catch (e) {
        // Mirror TxSignatureRequestRepository: fall back to the warm LRU cache instead of losing
        // every account (including the signing account) on a transient API blip.
        accountInfoMap = this._accountInfoRepository.accountsInfoMapCache;
        accounts = 'failed';
        this._logger.reportError(e, 'EIP712Repository.prepareSignatureRequest: getAccountsInfo');
      }

      const contractPackageHash = typedData.domain.contract_package_hash;
      if (contractPackageHash) {
        try {
          contractPackage = await this._contractPackageRepository.getContractPackage({
            contractPackageHash: stripHexPrefix(String(contractPackageHash)),
            network,
            withProxyHeader,
          });
          contractPackageStatus = 'ok';
        } catch (e) {
          contractPackageStatus = 'failed';
          this._logger.reportError(
            e,
            'EIP712Repository.prepareSignatureRequest: getContractPackage',
          );
        }
      } else {
        contractPackageStatus = 'absent';
      }
    }

    try {
      return new EIP712SignatureRequestDto({
        typedData,
        signingPublicKeyHex,
        network,
        digest,
        hashArtifacts,
        accountInfoMap,
        contractPackage,
        enrichment: { accounts, contractPackage: contractPackageStatus },
      });
    } catch (e) {
      // DTO construction can throw outside the digest path (e.g. JSON.stringify on a circular ref in
      // a payload region hashTypedData never visits). Keep the documented `EIP712Error` contract.
      throw isEIP712Error(e) ? e : new EIP712Error(e, 'prepareSignatureRequest');
    }
  }
}
