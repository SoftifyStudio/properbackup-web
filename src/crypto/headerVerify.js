/**
 * ProperBackup header verification using the Web Crypto API (browser/Node 19+).
 *
 * Header layout (49 bytes, matches HeaderCodec.java):
 *   [0-3]   PROP magic
 *   [4]     version 0x01
 *   [5-20]  16-byte salt
 *   [21-32] 12-byte GCM nonce for canary
 *   [33-48] 16-byte AES-GCM auth tag of CANARY_PLAINTEXT
 *
 * Password verification:
 *   1. Read first 49 bytes (cheap Range request to OVH)
 *   2. Derive AES-256 key: PBKDF2(password, salt, 200_000 iters, SHA-256)
 *   3. AES-GCM decrypt the canary block (nonce from header, tag from header)
 *   4. If decryption succeeds → password correct
 *   5. If AES-GCM throws (tag mismatch) → password wrong
 */

const MAGIC          = [0x50, 0x52, 0x4F, 0x50]; // "PROP"
const VERSION        = 0x01;
const HEADER_SIZE    = 49;
const PBKDF2_ITERS   = 200_000;
const CANARY_PLAIN   = new TextEncoder().encode('VERIFIED\0\0\0\0\0\0\0\0'); // 16 bytes

export class BadPasswordError extends Error {
  constructor() { super('Wrong password — PROP canary mismatch'); }
}

export class InvalidFileError extends Error {
  constructor(msg) { super(msg); }
}

/**
 * Parses the 49-byte header from an ArrayBuffer.
 * @param {ArrayBuffer} buf — must be at least 49 bytes
 * @returns {{ salt: Uint8Array, nonce: Uint8Array, authTag: Uint8Array }}
 */
export function parseHeader(buf) {
  if (buf.byteLength < HEADER_SIZE) {
    throw new InvalidFileError(`Buffer too small: ${buf.byteLength} < ${HEADER_SIZE}`);
  }
  const v = new Uint8Array(buf);

  for (let i = 0; i < 4; i++) {
    if (v[i] !== MAGIC[i]) throw new InvalidFileError('Not a ProperBackup file — magic mismatch');
  }
  if (v[4] !== VERSION) throw new InvalidFileError(`Unsupported version: ${v[4]}`);

  return {
    salt:    v.slice(5, 21),   // 16 bytes
    nonce:   v.slice(21, 33),  // 12 bytes
    authTag: v.slice(33, 49),  // 16 bytes
  };
}

/**
 * Derives an AES-256-GCM CryptoKey from password + salt using PBKDF2-SHA256.
 * @param {string} password
 * @param {Uint8Array} salt
 * @returns {Promise<CryptoKey>}
 */
async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const raw = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERS, hash: 'SHA-256' },
    raw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Verifies password against a pre-parsed header object.
 * Resolves if password is correct, rejects with BadPasswordError if not.
 *
 * @param {string} password
 * @param {{ salt: Uint8Array, nonce: Uint8Array, authTag: Uint8Array }} header
 * @returns {Promise<void>}
 */
export async function verifyPasswordFromHeader(password, header) {
  const key = await deriveKey(password, header.salt);

  // Reconstruct the ciphertext+tag block the Java side produced:
  //   Java's Cipher.doFinal(CANARY_PLAIN) returns [encryptedCanary(16) | tag(16)] = 32 bytes
  //   We stored only the last 16 bytes (the tag) in the header.
  //   To verify, we encrypt the same plaintext and compare tags.
  let computedTag;
  try {
    const encResult = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: header.nonce, tagLength: 128 },
      key,
      CANARY_PLAIN,
    );
    // Web Crypto appends the 16-byte tag at the end: [16 enc bytes][16 tag bytes]
    computedTag = new Uint8Array(encResult).slice(16);
  } catch {
    throw new BadPasswordError();
  }

  if (!constantTimeEqual(computedTag, header.authTag)) {
    throw new BadPasswordError();
  }
}

/**
 * Full convenience: parse header bytes then verify password.
 *
 * @param {string} password
 * @param {ArrayBuffer} headerBytes — first 49 bytes of the .enc file
 * @returns {Promise<void>} — resolves on success, throws BadPasswordError on failure
 */
export async function verifyPassword(password, headerBytes) {
  const header = parseHeader(headerBytes);
  await verifyPasswordFromHeader(password, header);
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
