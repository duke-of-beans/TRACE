/**
 * TRACE PWA — App Lock (PIN + Biometric)
 *
 * The device encryption key is encrypted WITH the user's PIN.
 * Without the PIN, the key is inaccessible and all queue data
 * remains doubly encrypted ciphertext.
 *
 * Flow:
 * 1. First login: user sets a 4-6 digit PIN
 * 2. PIN is used to derive a KEK (key-encrypting-key) via PBKDF2
 * 3. The AES device key is encrypted with the KEK and stored
 * 4. On every app open: PIN required to decrypt the device key
 * 5. Optional: biometric (WebAuthn) as fast alternative to PIN
 */

const PIN_HASH_KEY = "trace_pin_hash";
const ENCRYPTED_KEY_KEY = "trace_ek_wrapped";
const LOCK_STATE_KEY = "trace_locked";
const PBKDF2_ITERATIONS = 100000;
const SALT_KEY = "trace_pin_salt";

/**
 * Derive a key-encrypting-key from the PIN via PBKDF2.
 */
async function deriveKEK(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const pinKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    pinKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Set up the PIN lock. Encrypts the device key with the PIN.
 * Called once during initial setup.
 */
export async function setupPIN(pin: string, deviceKeyJWK: JsonWebKey): Promise<void> {
  // hash PIN for quick verification (not for crypto - KEK handles that)
  const pinHash = await hashPIN(pin);
  localStorage.setItem(PIN_HASH_KEY, pinHash);

  // generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  localStorage.setItem(SALT_KEY, btoa(String.fromCharCode(...salt)));

  // derive KEK from PIN
  const kek = await deriveKEK(pin, salt);

  // encrypt the device key with KEK
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const deviceKeyStr = JSON.stringify(deviceKeyJWK);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    kek,
    new TextEncoder().encode(deviceKeyStr)
  );

  // store: iv + ciphertext
  const packed = new Uint8Array(12 + ciphertext.byteLength);
  packed.set(iv);
  packed.set(new Uint8Array(ciphertext), 12);
  localStorage.setItem(ENCRYPTED_KEY_KEY, btoa(String.fromCharCode(...packed)));

  // remove the raw device key — only the wrapped version remains
  localStorage.removeItem("trace_ek");

  // set locked state
  localStorage.setItem(LOCK_STATE_KEY, "locked");
}

/**
 * Unlock the app with PIN. Decrypts the device key.
 * Returns the JWK of the device key if PIN is correct, null if wrong.
 */
export async function unlockWithPIN(pin: string): Promise<JsonWebKey | null> {
  // quick hash check first
  const stored = localStorage.getItem(PIN_HASH_KEY);
  if (!stored) return null;

  const check = await hashPIN(pin);
  if (check !== stored) return null;

  // derive KEK
  const saltB64 = localStorage.getItem(SALT_KEY);
  if (!saltB64) return null;
  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
  const kek = await deriveKEK(pin, salt);

  // decrypt device key
  const wrappedB64 = localStorage.getItem(ENCRYPTED_KEY_KEY);
  if (!wrappedB64) return null;

  try {
    const packed = Uint8Array.from(atob(wrappedB64), (c) => c.charCodeAt(0));
    const iv = packed.slice(0, 12);
    const ciphertext = packed.slice(12);

    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      kek,
      ciphertext
    );

    const jwk = JSON.parse(new TextDecoder().decode(plaintext));
    localStorage.setItem(LOCK_STATE_KEY, "unlocked");
    return jwk;
  } catch {
    return null; // wrong PIN (decryption failed)
  }
}

/**
 * Check if a PIN has been set up.
 */
export function hasPIN(): boolean {
  return !!localStorage.getItem(PIN_HASH_KEY);
}

/**
 * Check if the app is currently locked.
 */
export function isLocked(): boolean {
  return localStorage.getItem(LOCK_STATE_KEY) !== "unlocked";
}

/**
 * Lock the app (e.g. on visibility change, timer).
 */
export function lock(): void {
  localStorage.setItem(LOCK_STATE_KEY, "locked");
  // remove raw key from memory
  localStorage.removeItem("trace_ek");
}

/**
 * Auto-lock after inactivity. Call on app init.
 */
export function setupAutoLock(timeoutMs = 5 * 60 * 1000): void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const resetTimer = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => lock(), timeoutMs);
  };

  // reset on any interaction
  ["touchstart", "mousedown", "keydown", "scroll"].forEach((evt) => {
    document.addEventListener(evt, resetTimer, { passive: true });
  });

  // lock when app goes to background
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) lock();
  });

  resetTimer();
}

async function hashPIN(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin + "trace_pin_pepper");
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}
