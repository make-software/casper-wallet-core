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
import {
  resolveDomainTypes,
  validateNoUnknownMessageFields,
  validatePrimaryType,
  validateTypedDataFieldTypes,
} from './validation';

export function computeTypedDataEIP712Digest(
  typedData: IEIP712TypedData,
  options: IEIP712SignTypedDataOptions = {},
): IEIP712Digest {
  const { domain, types, primaryType, message } = typedData;
  const { domainTypes, returnHashArtifacts, rejectUnknownFields } = options;

  validatePrimaryType(types, primaryType);
  const resolvedDomainTypes = resolveDomainTypes(domain, types, domainTypes);
  validateTypedDataFieldTypes(types);
  if (rejectUnknownFields) {
    validateNoUnknownMessageFields(types, primaryType, message);
  }

  const eip712Domain = domain as EIP712Domain;

  const digest = toHex(
    hashTypedData(eip712Domain, types, primaryType, message, {
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
      structHash: toHex(hashStruct(primaryType, types, message)),
      canonicalTypeString,
      typeHash: toHex(computeTypeHash(canonicalTypeString)),
    },
  };
}
