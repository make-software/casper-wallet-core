import {
  buildCanonicalTypeString,
  buildDomainTypeString,
  EIP712Domain,
  hashDomainSeparator,
  hashTypedDataRaw,
  toHex,
} from '@casper-ecosystem/casper-eip-712';
import { IEIP712Digest, IEIP712SignTypedDataOptions, IEIP712TypedData } from '../../domain';
import { encodeTypedDataEIP712Struct, hashTypedDataEIP712Struct } from './encode';
import { normalizeEip712Struct } from './numbers';
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

  const normalizedMessage = normalizeEip712Struct(primaryType, types, message);
  const eip712Domain = domain as EIP712Domain;

  const { typeHash, encodedData } = encodeTypedDataEIP712Struct(
    primaryType,
    types,
    normalizedMessage,
  );
  const digest = toHex(
    hashTypedDataRaw(eip712Domain, typeHash, encodedData, { domainTypes: resolvedDomainTypes }),
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
      structHash: toHex(hashTypedDataEIP712Struct(primaryType, types, normalizedMessage)),
      canonicalTypeString,
      typeHash: toHex(typeHash),
    },
  };
}
