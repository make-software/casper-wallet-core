import {
  convertBase64ToBytes,
  convertBytesToBase64,
  convertBytesToHex,
  convertBytesToHexString,
  convertHexToBytes,
  privateKeyBytesToBase64,
  publicKeyBytesToHex,
} from './crypto';

const HEX = '00ff10abcdef';
const HEX_BYTES = Uint8Array.from([0x00, 0xff, 0x10, 0xab, 0xcd, 0xef]);

describe('crypto utils', () => {
  describe('hex ↔ bytes', () => {
    it('converts a known hex string to bytes', () => {
      expect(convertHexToBytes(HEX)).toEqual(HEX_BYTES);
    });

    it('converts bytes back to hex', () => {
      expect(convertBytesToHex(HEX_BYTES)).toBe(HEX);
    });

    it('round-trips hex → bytes → hex', () => {
      expect(convertBytesToHex(convertHexToBytes(HEX))).toBe(HEX);
    });

    it('handles empty input', () => {
      expect(convertHexToBytes('')).toEqual(new Uint8Array(0));
      expect(convertBytesToHex(new Uint8Array(0))).toBe('');
    });

    it('accepts ArrayBuffer input for convertBytesToHex', () => {
      const buf = HEX_BYTES.buffer.slice(
        HEX_BYTES.byteOffset,
        HEX_BYTES.byteOffset + HEX_BYTES.byteLength,
      );
      expect(convertBytesToHex(buf)).toBe(HEX);
    });
  });

  describe('base64 ↔ bytes', () => {
    it('round-trips bytes → base64 → bytes', () => {
      const b64 = convertBytesToBase64(HEX_BYTES);
      expect(convertBase64ToBytes(b64)).toEqual(HEX_BYTES);
    });

    it('handles empty input', () => {
      expect(convertBytesToBase64(new Uint8Array(0))).toBe('');
      expect(convertBase64ToBytes('')).toEqual(new Uint8Array(0));
    });

    it('accepts ArrayBuffer input for convertBytesToBase64', () => {
      const buf = HEX_BYTES.buffer.slice(
        HEX_BYTES.byteOffset,
        HEX_BYTES.byteOffset + HEX_BYTES.byteLength,
      );
      const b64Direct = convertBytesToBase64(HEX_BYTES);
      expect(convertBytesToBase64(buf)).toBe(b64Direct);
    });
  });

  describe('privateKeyBytesToBase64', () => {
    it('serializes private key bytes to base64', () => {
      expect(privateKeyBytesToBase64(HEX_BYTES)).toBe(convertBytesToBase64(HEX_BYTES));
    });
  });

  describe('publicKeyBytesToHex', () => {
    it('prepends the secp256k1 prefix (02)', () => {
      const out = publicKeyBytesToHex(HEX_BYTES);
      expect(out.startsWith('02')).toBe(true);
      expect(out).toBe(`02${HEX}`);
    });
  });

  describe('convertBytesToHexString', () => {
    it('matches convertBytesToHex output', () => {
      expect(convertBytesToHexString(HEX_BYTES)).toBe(convertBytesToHex(HEX_BYTES));
    });

    it('zero-pads single-digit bytes', () => {
      expect(convertBytesToHexString(Uint8Array.from([0x01, 0x0a]))).toBe('010a');
    });
  });
});
