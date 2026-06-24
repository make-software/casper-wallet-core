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
import {
  buildTypedDataEIP712DisplayModel,
  computeTypedDataEIP712Digest,
  getCasperNetworkByChainName,
  recoverTypedDataEIP712SignerAddress,
  signTypedDataEIP712 as signTypedDataEIP712Util,
  signTypedDataEIP712DigestWithKey,
  verifyTypedDataEIP712Signature,
} from '../../../utils';
import {
  EIP712_CHAIN_NAME_KEY,
  EIP712SignatureRequestDto,
  getAccountHashesFromTypedDataEIP712,
  getPackageHashesFromTypedDataEIP712,
} from '../../dto';

/**
 * `prepareSignatureRequest` is asynchronous: it enriches the typed data with account info and
 * contract-package data over HTTP (best-effort — each lookup is isolated in its own try/catch, so a
 * flaky API never breaks the request). The other methods are synchronous pure-CPU work.
 *
 * `computeDigest`, `signDigest` and `signTypedDataEIP712` wrap unexpected failures in {@link EIP712Error}.
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
      return computeTypedDataEIP712Digest(typedData, options);
    } catch (e) {
      throw isEIP712Error(e) ? e : new EIP712Error(e, 'computeDigest');
    }
  }

  buildDisplayModel(typedData: IEIP712TypedData): IEIP712DisplayModel {
    return buildTypedDataEIP712DisplayModel(typedData);
  }

  signDigest({ privateKey, digest }: IEIP712SignDigestParams): IEIP712SignResult {
    try {
      return signTypedDataEIP712DigestWithKey(privateKey, digest);
    } catch (e) {
      throw isEIP712Error(e) ? e : new EIP712Error(e, 'signDigest');
    }
  }

  signTypedDataEIP712({
    typedData,
    privateKey,
    options,
  }: IEIP712SignTypedDataParams): IEIP712SignResult {
    try {
      return signTypedDataEIP712Util(typedData, privateKey, options);
    } catch (e) {
      throw isEIP712Error(e) ? e : new EIP712Error(e, 'signTypedDataEIP712');
    }
  }

  recoverSigner(params: IEIP712RecoverSignerParams): string {
    return recoverTypedDataEIP712SignerAddress(params);
  }

  verifySignature(params: IEIP712VerifySignatureParams): boolean {
    return verifyTypedDataEIP712Signature(params);
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
      getCasperNetworkByChainName(String(typedData.domain[EIP712_CHAIN_NAME_KEY] ?? '')) ??
      networkParam ??
      null;

    let accountInfoMap: Record<string, IAccountInfo> = {};
    let contractPackageMap: Record<string, IContractPackage> = {};
    let accounts: EIP712EnrichmentStatus = 'skipped';
    let contractPackageStatus: EIP712ContractEnrichmentStatus = 'skipped';

    if (network) {
      // Pure-CPU; kept outside the try so a bug here surfaces instead of being mislabeled API flakiness.
      const accountHashes = getAccountHashesFromTypedDataEIP712(typedData, signingPublicKeyHex);
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

      const packageHashes = getPackageHashesFromTypedDataEIP712(typedData);
      if (packageHashes.length === 0) {
        contractPackageStatus = 'absent';
      } else {
        // Independent lookups — run in parallel, but keep per-package isolation so one failure
        // doesn't reject the batch (unlike account info, which is a single batched call).
        const results = await Promise.allSettled(
          packageHashes.map(packageHash =>
            this._contractPackageRepository.getContractPackage({
              contractPackageHash: packageHash,
              network,
              withProxyHeader,
            }),
          ),
        );

        let anyOk = false;
        let anyFailed = false;
        results.forEach((result, i) => {
          if (result.status === 'fulfilled') {
            if (result.value) {
              contractPackageMap[packageHashes[i]] = result.value;
            }
            anyOk = true;
          } else {
            anyFailed = true;
            this._logger.reportError(
              result.reason,
              'EIP712Repository.prepareSignatureRequest: getContractPackage',
            );
          }
        });
        // Distinguish a degraded `partial` (some succeeded, some threw) from a clean `ok`/`failed`,
        // so consumers can surface a partial-enrichment warning instead of trusting a coarse `ok`.
        contractPackageStatus = anyOk ? (anyFailed ? 'partial' : 'ok') : 'failed';
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
        contractPackageMap,
        enrichment: { accounts, contractPackage: contractPackageStatus },
      });
    } catch (e) {
      // DTO construction can throw outside the digest path (e.g. JSON.stringify on a circular ref in
      // a payload region hashTypedData never visits). Keep the documented `EIP712Error` contract.
      throw isEIP712Error(e) ? e : new EIP712Error(e, 'prepareSignatureRequest');
    }
  }
}
