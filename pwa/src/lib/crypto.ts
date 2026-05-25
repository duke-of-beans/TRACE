/**
 * TRACE PWA — Device Encryption (Web Crypto API)
 *
 * All queue data encrypted at rest on the device.
 * AES-256-GCM with key derived from session.
 * Destroying the key renders all stored data irrecoverable.
 */

const ALGO = "AES-GCM";
const KEY_STORAGE = "trace_ek"; // encrypted key identifier

/**
 * Generate a fresh AES-256 encryption key.
 * Called once on first login. Stored in memory + localStorage as JWK.
 */
export async function generateDeviceKey(): Promise<CryptoKey> {
  const key = await crypto.subtle.generateKey(
    { name: ALGO, length: 256 },
    true, // extractable so we can export to JWK for storage
    ["encrypt", "decrypt"]
  );
  // export and store
  const jwk = await crypto.subtle.exportKey("jwk", key);
  localStorage.setItem(KEY_STORAGE, JSON.stringify(jwk));
  return key;
}

/**
 * Load the device key from localStorage.
 * Returns null if no key exists (first run or post-panic).
 */
export async function loadDeviceKey(): Promise<CryptoKey | null> {
  const raw = localStorage.getItem(KEY_STORAGE);
  if (!raw) return null;
  try {
    const jwk = JSON.parse(raw);
    return await crypto.subtle.importKey(
      "jwk", jwk, { name: ALGO }, true, ["encrypt", "decrypt"]
    );
  } catch {
    return null;
  }
}

/**
 * Encrypt a buffer or string. Returns base64-encoded iv+ciphertext.
 */
export async function encryptData(
  key: CryptoKey,
  data: ArrayBuffer | string
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = typeof data === "string"
    ? new TextEncoder().encode(data)
    : new Uint8Array(data);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGO, iv },
    key,
    plaintext
  );

  // pack: iv (12 bytes) + ciphertext
  const packed = new Uint8Array(12 + ciphertext.byteLength);
  packed.set(iv);
  packed.set(new Uint8Array(ciphertext), 12);

  return btoa(String.fromCharCode(...packed));
}

/**
 * Decrypt base64-encoded data back to string.
 */
export async function decryptData(
  key: CryptoKey,
  encoded: string
): Promise<string> {
  const packed = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  const iv = packed.slice(0, 12);
  const ciphertext = packed.slice(12);

  const plaintext = await crypto.subtle.decrypt(
    { name: ALGO, iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(plaintext);
}

/**
 * Encrypt a photo blob. Returns encrypted base64 string.
 */
export async function encryptPhoto(
  key: CryptoKey,
  photoBlob: Blob
): Promise<string> {
  const buffer = await photoBlob.arrayBuffer();
  return encryptData(key, buffer);
}

/**
 * Decrypt a photo back to Blob.
 */
export async function decryptPhoto(
  key: CryptoKey,
  encrypted: string,
  mimeType = "image/jpeg"
): Promise<Blob> {
  const packed = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const iv = packed.slice(0, 12);
  const ciphertext = packed.slice(12);

  const plaintext = await crypto.subtle.decrypt(
    { name: ALGO, iv },
    key,
    ciphertext
  );

  return new Blob([plaintext], { type: mimeType });
}
