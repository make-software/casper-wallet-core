import {
  buildCanonicalTypeString,
  buildDomainTypeString,
  computeTypeHash,
  EIP712Domain,
  hashDomainSeparator,
  hashStruct,
  hashTypedData,
  toHex,
} from '@casper-ecosystem/casper-eip-712';
import { IEIP712Digest, IEIP712SignTypedDataOptions, IEIP712TypedData } from '../../domain';
import { normalizeEip712Numbers } from './numbers';
import { validateTypedDataEIP712 } from './validation';

export function computeTypedDataEIP712Digest(
  typedData: IEIP712TypedData,
  options: IEIP712SignTypedDataOptions = {},
): IEIP712Digest {
  const { domain, types, primaryType, message } = typedData;
  const { domainTypes, returnHashArtifacts, rejectUnknownFields } = options;

  const resolvedDomainTypes = validateTypedDataEIP712(typedData, {
    domainTypes,
    rejectUnknownFields,
  });

  const normalizedMessage = normalizeEip712Numbers(types[primaryType], message);
  const eip712Domain = domain as EIP712Domain;

  const digest = toHex(
    hashTypedData(eip712Domain, types, primaryType, normalizedMessage, {
      domainTypes: resolvedDomainTypes,
    }),
  );

  if (!returnHashArtifacts) {
    return { digest, resolvedDomainTypes };
  }

  const canonicalTypeString = buildCanonicalTypeString(primaryType, types);
  return {
    digest,
    resolvedDomainTypes,
    hashArtifacts: {
      domainTypeString: buildDomainTypeString(eip712Domain, resolvedDomainTypes),
      domain,
      domainSeparator: toHex(hashDomainSeparator(eip712Domain, resolvedDomainTypes)),
      structHash: toHex(hashStruct(primaryType, types, normalizedMessage)),
      canonicalTypeString,
      typeHash: toHex(computeTypeHash(canonicalTypeString)),
    },
  };
}
