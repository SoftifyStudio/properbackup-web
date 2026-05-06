/**
 * Streaming AES-256-GCM decryption in the browser (Web Crypto API).
 *
 * Mirrors ProperCrypto.java chunk format:
 *   [49-byte header]
 *   For each chunk: [4-byte BE len][12-byte nonce][ciphertext + 16-byte GCM tag]
 *
 * Returns a Blob containing the decrypted tar.gz.
 */

import { parseHeader, verifyPasswordFromHeader, BadPasswordError } from './headerVerify.js';

const PBKDF2_ITERS = 200_000;

async function deriveKey(password, salt) {
  const raw = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERS, hash: 'SHA-256' },
    raw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
}

/**
 * Decrypts a full .enc ArrayBuffer.
 *
 * @param {string} password
 * @param {ArrayBuffer} encBuffer — full content of the .enc file
 * @returns {Promise<Blob>} — decrypted tar.gz as a Blob
 * @throws {BadPasswordError} if password is wrong
 */
export async function decrypt(password, encBuffer) {
  const view = new DataView(encBuffer);
  const bytes = new Uint8Array(encBuffer);

  // Parse and verify header (bytes 0-48)
  const header = parseHeader(encBuffer);
  await verifyPasswordFromHeader(password, header);

  const key = await deriveKey(password, header.salt);

  const chunks = [];
  let offset = 49; // skip header

  while (offset < bytes.length) {
    if (offset + 4 > bytes.length) break;

    const frameLen = view.getUint32(offset, false); // big-endian
    offset += 4;

    if (offset + frameLen > bytes.length) {
      throw new Error(`Truncated chunk at offset ${offset}`);
    }

    const nonce     = bytes.slice(offset, offset + 12);
    const cipherData = bytes.slice(offset + 12, offset + frameLen);
    offset += frameLen;

    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: nonce, tagLength: 128 },
      key,
      cipherData,
    );
    chunks.push(new Uint8Array(plain));
  }

  return new Blob(chunks, { type: 'application/gzip' });
}

/**
 * Decrypts and triggers a browser download of the tar.gz.
 *
 * @param {string} password
 * @param {ArrayBuffer} encBuffer
 * @param {string} filename — suggested download filename
 */
export async function decryptAndDownload(password, encBuffer, filename = 'backup.tar.gz') {
  const blob = await decrypt(password, encBuffer);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
