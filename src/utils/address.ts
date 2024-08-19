import { Maybe } from '../typings';

/**
 * Method to format the address to a shorter version
 * @param {string} rawAddress - Full public address
 * @param {string} type - Format type
 * @param {number} chars - Number of characters to show at the end and beginning. Defaults to 5.
 * @returns {string} Formatted address
 */
export const formatAddress = (
  rawAddress: string,
  type: string | 'short' | 'mid' = 'short',
  chars: number = 5,
): string => {
  let formattedAddress = rawAddress;

  if (type === 'short') {
    formattedAddress = renderShortAddress(rawAddress, chars);
  } else if (type === 'mid') {
    formattedAddress = renderSlightlyLongAddress(rawAddress);
  } else {
    formattedAddress = rawAddress;
  }

  return formattedAddress;
};

/**
 * Returns short address format
 *
 * @param {string} address - String corresponding to an address
 * @param {number} chars - Number of characters to show at the end and beginning.
 * Defaults to 5.
 * @returns {string} - String corresponding to short address format
 */
export function renderShortAddress(address: string, chars: number = 5): string {
  if (!address) {
    return '';
  }

  const minLength = chars * 2 + 3;

  if (address.length <= minLength) {
    return address;
  }

  return `${address.substring(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Returns middle address format
 *
 * @param {string} address - String corresponding to an address
 * @param {number} chars - Number of characters to show at the end and beginning.
 * Defaults to 4.
 * @param {number} initialChars
 * @returns {string} - String corresponding to short address format
 */
export function renderSlightlyLongAddress(
  address: string,
  chars: number = 4,
  initialChars: number = 20,
): string {
  if (!address) {
    return '';
  }

  const minLength = chars * 2 + initialChars + 3;

  if (address.length <= minLength) {
    return address;
  }

  return `${address.substring(0, chars + initialChars)}...${address.slice(-chars)}`;
}

export const isPublicKeyHash = (hash?: Maybe<string>) => {
  return hash?.startsWith('01') || hash?.startsWith('02');
};
