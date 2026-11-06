import { buildDomain } from '@casper-ecosystem/casper-eip-712';
import { IEIP712TypedData, IEIP712Types } from '../domain';

export type Permit2AddressBytes = 20 | 33;

export const PERMIT2_TYPES: IEIP712Types = {
  PermitTransferFrom: [
    { name: 'permitted', type: 'TokenPermissions' },
    { name: 'spender', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
  PermitBatchTransferFrom: [
    { name: 'permitted', type: 'TokenPermissions[]' },
    { name: 'spender', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
  PermitWitnessTransferFrom: [
    { name: 'permitted', type: 'TokenPermissions' },
    { name: 'spender', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
    { name: 'witness', type: 'ExampleWitness' },
  ],
  PermitBatchWitnessTransferFrom: [
    { name: 'permitted', type: 'TokenPermissions[]' },
    { name: 'spender', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
    { name: 'witness', type: 'ExampleWitness' },
  ],
  PermitSingle: [
    { name: 'details', type: 'PermitDetails' },
    { name: 'spender', type: 'address' },
    { name: 'sigDeadline', type: 'uint256' },
  ],
  PermitBatch: [
    { name: 'details', type: 'PermitDetails[]' },
    { name: 'spender', type: 'address' },
    { name: 'sigDeadline', type: 'uint256' },
  ],
  TokenPermissions: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
  PermitDetails: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint160' },
    { name: 'expiration', type: 'uint48' },
    { name: 'nonce', type: 'uint48' },
  ],
  ExampleWitness: [
    { name: 'recipient', type: 'address' },
    { name: 'orderId', type: 'bytes32' },
  ],
};

export const PERMIT2_PRIMARY_TYPES = [
  'PermitTransferFrom',
  'PermitBatchTransferFrom',
  'PermitWitnessTransferFrom',
  'PermitBatchWitnessTransferFrom',
  'PermitSingle',
  'PermitBatch',
] as const;

export type Permit2PrimaryType = (typeof PERMIT2_PRIMARY_TYPES)[number];

function address(seed: string, bytes: Permit2AddressBytes): string {
  return bytes === 20 ? '0x' + seed.repeat(20) : '0x01' + seed.repeat(32);
}

function sampleMessage(
  primaryType: Permit2PrimaryType,
  bytes: Permit2AddressBytes,
): Record<string, unknown> {
  const permission = (seed: string, amount: string) => ({
    token: address(seed, bytes),
    amount,
  });
  const detail = (seed: string, amount: string, nonce: string) => ({
    token: address(seed, bytes),
    amount,
    expiration: '1793613657',
    nonce,
  });
  const witness = { recipient: address('0a', bytes), orderId: '0x' + 'ab'.repeat(32) };
  const common = { spender: address('02', bytes), nonce: '0x01', deadline: '1793613657' };

  switch (primaryType) {
    case 'PermitTransferFrom':
      return { permitted: permission('01', '1000'), ...common };
    case 'PermitBatchTransferFrom':
      return { permitted: [permission('01', '1000'), permission('03', '0x03e9')], ...common };
    case 'PermitWitnessTransferFrom':
      return { permitted: permission('01', '1000'), ...common, witness };
    case 'PermitBatchWitnessTransferFrom':
      return {
        permitted: [permission('01', '1000'), permission('03', '0x03e9')],
        ...common,
        witness,
      };
    case 'PermitSingle':
      return {
        details: detail('01', '1000', '0'),
        spender: common.spender,
        sigDeadline: common.deadline,
      };
    case 'PermitBatch':
      return {
        details: [detail('01', '1000', '0'), detail('03', '0x03e9', '1')],
        spender: common.spender,
        sigDeadline: common.deadline,
      };
  }
}

export const PERMIT2_MESSAGES: Record<
  Permit2PrimaryType,
  Record<Permit2AddressBytes, Record<string, unknown>>
> = Object.fromEntries(
  PERMIT2_PRIMARY_TYPES.map(type => [
    type,
    { 20: sampleMessage(type, 20), 33: sampleMessage(type, 33) },
  ]),
) as Record<Permit2PrimaryType, Record<Permit2AddressBytes, Record<string, unknown>>>;

function reachableTypes(primaryType: string): IEIP712Types {
  const out: IEIP712Types = {};
  const visit = (name: string) => {
    if (out[name] || !PERMIT2_TYPES[name]) {
      return;
    }
    out[name] = PERMIT2_TYPES[name];
    PERMIT2_TYPES[name].forEach(({ type }) => visit(type.replace(/\[\d*\]$/, '')));
  };
  visit(primaryType);
  return out;
}

export function buildPermit2TypedData(
  primaryType: Permit2PrimaryType,
  message?: Record<string, unknown>,
  addressBytes: Permit2AddressBytes = 20,
): IEIP712TypedData {
  return {
    domain: buildDomain('Permit2', '1', 'casper', '0x' + '01'.repeat(32)),
    types: reachableTypes(primaryType),
    primaryType,
    message: message ?? PERMIT2_MESSAGES[primaryType][addressBytes],
  };
}
