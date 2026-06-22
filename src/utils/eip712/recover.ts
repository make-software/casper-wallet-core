import {
  ApprovalTypes,
  buildDomain,
  CASPER_DOMAIN_TYPES,
  EIP712Domain,
  fromHex,
  PermitTypes,
  recoverTypedDataSigner,
  toHex,
  TransferTypes,
  verifySignature as libVerifySignature,
} from '@casper-ecosystem/casper-eip-712';
import { IEIP712RecoverSignerParams, IEIP712VerifySignatureParams } from '../../domain';
import { resolveDomainTypes } from './validation';

/**
 * NOTE: these wrappers are secp256k1 / Ethereum-style. `signature` must be the raw 65-byte
 * recoverable signature (r‖s‖v) and `recoverTypedDataEIP712SignerAddress` returns a 0x-prefixed 20-byte
 * Ethereum address. They do NOT accept the wallet's `02`-prefixed 64-byte wire format and do NOT
 * apply to ed25519 (use the native key's verifySignature for ed25519).
 */
export function recoverTypedDataEIP712SignerAddress({
  typedData,
  signature,
  options,
}: IEIP712RecoverSignerParams): string {
  const { domain, types, primaryType, message } = typedData;
  const resolvedDomainTypes = resolveDomainTypes(domain, types, options?.domainTypes);
  const addressBytes = recoverTypedDataSigner(
    domain as EIP712Domain,
    types,
    primaryType,
    message,
    signature,
    { domainTypes: resolvedDomainTypes },
  );
  return toHex(addressBytes);
}

/** secp256k1 only; `signature` is the raw 65-byte recoverable sig (r‖s‖v) over the keccak256 digest. */
export function verifyTypedDataEIP712Signature({
  digest,
  signature,
  expectedAddress,
}: IEIP712VerifySignatureParams): boolean {
  return libVerifySignature(fromHex(digest), signature, expectedAddress);
}

// Re-export lib helpers so consumers build typed data without importing the lib directly.
export { CASPER_DOMAIN_TYPES, buildDomain, PermitTypes, ApprovalTypes, TransferTypes };
