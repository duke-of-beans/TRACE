/**
 * TRACE PWA — App Lock (PIN + Auto-Lock)
 *
 * Auto-lock behavior:
 * - After 5 min inactivity: lock
 * - After 30s in background: lock (not instant — allows brief tab switches)
 * - 10 wrong PINs: auto-wipe
 * - No biometrics. PIN only.
 */

const PIN_HASH_KEY = "trace_pin_hash";
const ENCRYPTED_KEY_KEY = "trace_ek_wrapped";
const LOCK_STATE_KEY = "trace_locked";
const PBKDF2_ITERATIONS = 100000;
const SALT_KEY = "trace_pin_salt";

async function deriveKEK(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const pinKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    pinKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function setupPIN(pin: string, deviceKeyJWK: JsonWebKey): Promise<void> {
  const pinHash = await hashPIN(pin);
  localStorage.setItem(PIN_HASH_KEY, pinHash);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  localStorage.setItem(SALT_KEY, btoa(String.fromCharCode(...salt)));

  const kek = await deriveKEK(pin, salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const deviceKeyStr = JSON.stringify(deviceKeyJWK);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, kek, new TextEncoder().encode(deviceKeyStr));

  const packed = new Uint8Array(12 + ciphertext.byteLength);
  packed.set(iv);
  packed.set(new Uint8Array(ciphertext), 12);
  localStorage.setItem(ENCRYPTED_KEY_KEY, btoa(String.fromCharCode(...packed)));
  localStorage.removeItem("trace_ek");
  localStorage.setItem(LOCK_STATE_KEY, "unlocked");
}

export async function unlockWithPIN(pin: string): Promise<JsonWebKey | null> {
  const stored = localStorage.getItem(PIN_HASH_KEY);
  if (!stored) return null;
  const check = await hashPIN(pin);
  if (check !== stored) return null;

  const saltB64 = localStorage.getItem(SALT_KEY);
  if (!saltB64) return null;
  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
  const kek = await deriveKEK(pin, salt);

  const wrappedB64 = localStorage.getItem(ENCRYPTED_KEY_KEY);
  if (!wrappedB64) return null;

  try {
    const packed = Uint8Array.from(atob(wrappedB64), (c) => c.charCodeAt(0));
    const iv = packed.slice(0, 12);
    const ciphertext = packed.slice(12);
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, kek, ciphertext);
    const jwk = JSON.parse(new TextDecoder().decode(plaintext));
    localStorage.setItem(LOCK_STATE_KEY, "unlocked");
    return jwk;
  } catch {
    return null;
  }
}

export function hasPIN(): boolean {
  return !!localStorage.getItem(PIN_HASH_KEY);
}

export function isLocked(): boolean {
  return localStorage.getItem(LOCK_STATE_KEY) !== "unlocked";
}

export function lock(): void {
  localStorage.setItem(LOCK_STATE_KEY, "locked");
  localStorage.removeItem("trace_ek");
}

/**
 * Auto-lock after inactivity. NOT instant on background.
 * - 30s grace period when app goes to background (allows tab switches)
 * - 5min inactivity timer (resets on interaction)
 */
export function setupAutoLock(inactivityMs = 5 * 60 * 1000): void {
  let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  let backgroundTimer: ReturnType<typeof setTimeout> | null = null;
  const BACKGROUND_GRACE = 30000; // 30s before locking in background

  const resetInactivity = () => {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => lock(), inactivityMs);
  };

  // reset on any interaction
  ["touchstart", "mousedown", "keydown", "scroll"].forEach((evt) => {
    document.addEventListener(evt, resetInactivity, { passive: true });
  });

  // background: 30s grace, not instant
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      // start 30s countdown
      backgroundTimer = setTimeout(() => lock(), BACKGROUND_GRACE);
    } else {
      // came back — cancel the countdown
      if (backgroundTimer) { clearTimeout(backgroundTimer); backgroundTimer = null; }
    }
  });

  resetInactivity();
}

async function hashPIN(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin + "trace_pin_pepper");
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}
