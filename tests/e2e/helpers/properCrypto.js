/**
 * ProperBackup .enc decryption helper (zero-knowledge client-side restore).
 *
 * .enc binary format:
 *   [49-byte header: "PROP"(4) + version(1) + salt(16) + canaryNonce(12) + canaryTag(16)]
 *   then 1..N frames: [4-byte BE frameLen][12-byte nonce][ciphertext + 16-byte GCM tag]
 *
 * Key derivation: PBKDF2-HMAC-SHA256, 200_000 iters, 32-byte AES-256 key.
 *
 * This mirrors the agent-side encryption (ProperCrypto) and the in-browser
 * restore path. It is intentionally a pure re-implementation so the test
 * verifies the real cryptographic contract — NOT a mock.
 */
import { pbkdf2Sync, createDecipheriv } from 'node:crypto';

export const PROP_HEADER_SIZE = 49;
export const PBKDF2_ITERS = 200_000;

/**
 * Decrypt a ProperBackup .enc buffer back to its plaintext (a tar.gz blob).
 * @param {Buffer} encBuffer raw .enc bytes
 * @param {string} encPass encryption password
 * @returns {Buffer} decrypted plaintext (tar.gz)
 */
export function decryptEnc(encBuffer, encPass) {
  if (encBuffer.length <= PROP_HEADER_SIZE) {
    throw new Error(`.enc too small: ${encBuffer.length} bytes`);
  }
  // Magic "PROP" + version 0x01
  if (
    encBuffer[0] !== 0x50 || encBuffer[1] !== 0x52 ||
    encBuffer[2] !== 0x4f || encBuffer[3] !== 0x50
  ) {
    throw new Error('Bad magic: not a PROP .enc object');
  }
  if (encBuffer[4] !== 0x01) {
    throw new Error(`Unsupported .enc version: ${encBuffer[4]}`);
  }

  const salt = encBuffer.subarray(5, 21);
  const key = pbkdf2Sync(encPass, salt, PBKDF2_ITERS, 32, 'sha256');

  const chunks = [];
  let offset = PROP_HEADER_SIZE;
  while (offset < encBuffer.length) {
    if (offset + 4 > encBuffer.length) break;
    const frameLen = encBuffer.readUInt32BE(offset);
    offset += 4;
    if (offset + frameLen > encBuffer.length) {
      throw new Error(`Truncated frame at offset ${offset}`);
    }
    const nonce = encBuffer.subarray(offset, offset + 12);
    const cipherAndTag = encBuffer.subarray(offset + 12, offset + frameLen);
    const tagStart = cipherAndTag.length - 16;
    const ciphertext = cipherAndTag.subarray(0, tagStart);
    const authTag = cipherAndTag.subarray(tagStart);
    offset += frameLen;

    const decipher = createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(authTag);
    chunks.push(Buffer.concat([decipher.update(ciphertext), decipher.final()]));
  }
  return Buffer.concat(chunks);
}
