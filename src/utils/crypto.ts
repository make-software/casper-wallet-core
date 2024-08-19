export const privateKeyBytesToBase64 = (privateKeyBytes: Uint8Array): string => {
  return Buffer.from(privateKeyBytes).toString('base64');
};

export const publicKeyBytesToHex = (publicKeyBytes: Uint8Array): string => {
  const prefix = '02';
  const publicKeyHex = Buffer.from(publicKeyBytes).toString('hex');

  return `${prefix}${publicKeyHex}`;
};

export const convertHexToBytes = (hexString: string): Uint8Array => {
  return Uint8Array.from(Buffer.from(hexString, 'hex'));
};

export const convertBytesToHex = (bytes: Uint8Array | ArrayBuffer): string => {
  return Buffer.from(bytes).toString('hex');
};

export const convertBase64ToBytes = (hexString: string): Uint8Array => {
  return Uint8Array.from(Buffer.from(hexString, 'base64'));
};

export const convertBytesToBase64 = (bytes: Uint8Array | ArrayBuffer): string => {
  return Buffer.from(bytes).toString('base64');
};

export const convertBytesToHexString = (byteArray: Uint8Array) =>
  [...new Uint8Array(byteArray)]
    .map((x: number): string => x.toString(16).padStart(2, '0'))
    .join('');
