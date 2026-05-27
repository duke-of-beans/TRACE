/**
 * TRACE — Field-Level Encryption
 *
 * AES-256-GCM encryption for sensitive fields in Vault B.
 * Reporter real names, emails, and phone numbers are encrypted
 * at rest. The encryption key is stored separately from the database
 * (OS keychain in production, env var for dev).
 *
 * Design: encrypt before INSERT, decrypt after SELECT.
 * A database dump reveals only ciphertext for identity fields.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const keyHex = process.env.VAULT_B_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length < 64) {
    throw new Error(
      "VAULT_B_ENCRYPTION_KEY must be set (64 hex chars = 256 bits). " +
    );
  }
  return Buffer.from(keyHex, "hex");
}

/**
 * Encrypt a plaintext string.
 * Returns: base64(iv + ciphertext + authTag)
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();

  // pack: iv (16) + encrypted (N) + authTag (16)
  const packed = Buffer.concat([iv, encrypted, authTag]);
  return packed.toString("base64");
}

/**
 * Decrypt a ciphertext string.
 * Expects: base64(iv + ciphertext + authTag)
 */
export function decrypt(ciphertext: string): string {
  const key = getKey();
  const packed = Buffer.from(ciphertext, "base64");

  const iv = packed.subarray(0, IV_LENGTH);
  const authTag = packed.subarray(packed.length - AUTH_TAG_LENGTH);
  const encrypted = packed.subarray(IV_LENGTH, packed.length - AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString("utf8");
}

/**
 * Encrypt an object's specified fields in-place.
 * Returns the object with encrypted field values.
 */
export function encryptFields<T extends Record<string, any>>(
  obj: T,
  fields: (keyof T)[]
): T {
  const result = { ...obj };
  for (const field of fields) {
    if (result[field] && typeof result[field] === "string") {
      result[field] = encrypt(result[field] as string) as any;
    }
  }
  return result;
}

/**
 * Decrypt an object's specified fields in-place.
 */
export function decryptFields<T extends Record<string, any>>(
  obj: T,
  fields: (keyof T)[]
): T {
  const result = { ...obj };
  for (const field of fields) {
    if (result[field] && typeof result[field] === "string") {
      try {
        result[field] = decrypt(result[field] as string) as any;
      } catch {
        // field may not be encrypted (migration period)
      }
    }
  }
  return result;
}

// --- Evidence Encryption (Vault C) ---

const EVIDENCE_FIELDS = ["storagePath"]; // evidence blobs are encrypted on disk, not in DB

function getEvidenceKey(): Buffer {
  const keyHex = process.env.EVIDENCE_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length < 64) {
    throw new Error("EVIDENCE_ENCRYPTION_KEY must be set (64 hex chars)");
  }
  return Buffer.from(keyHex, "hex");
}

/**
 * Encrypt a file buffer for Vault C storage.
 */
export function encryptEvidence(data: Buffer): Buffer {
  const key = getEvidenceKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(data);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, encrypted, authTag]);
}

/**
 * Decrypt a file buffer from Vault C storage.
 */
export function decryptEvidence(data: Buffer): Buffer {
  const key = getEvidenceKey();
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(data.length - AUTH_TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH, data.length - AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted;
}
