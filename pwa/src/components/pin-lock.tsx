/**
 * TRACE PWA — PIN Lock Screen
 */
import { useState } from "preact/hooks";
import { unlockWithPIN } from "../lib/app-lock.js";
import { Icon } from "./icon.js";

type PinLockProps = { onUnlock: () => void };

export function PinLock({ onUnlock }: PinLockProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const MAX_ATTEMPTS = 10;

  const handleSubmit = async () => {
    if (!pin) return;
    if (attempts >= MAX_ATTEMPTS) {
      const { panic } = await import("../lib/panic.js");
      panic();
      return;
    }
    try {
      const jwk = await unlockWithPIN(pin);
      if (jwk) {
        localStorage.setItem("trace_ek", JSON.stringify(jwk));
        onUnlock();
      } else {
        setAttempts((a) => a + 1);
        setError(`Wrong PIN. ${MAX_ATTEMPTS - attempts - 1} attempts remaining.`);
        setPin("");
      }
    } catch {
      setError("Unlock error. Try again.");
      setPin("");
    }
  };

  return (
    <div class="auth-screen">
      <div class="auth-card">
        <div style={{ color: "var(--text-muted)", marginBottom: "var(--sp-4)" }}>
          <Icon name="lock" size={40} />
        </div>
        <div class="wordmark-wrap" style={{ marginBottom: "var(--sp-2)" }}>
          <span class="wordmark wordmark-lg">TRACE</span>
          <span class="wordmark-rule"></span>
          <span class="wordmark-expansion">Tracking · Reporting · Analysis · Community Evidence</span>
          <span class="wordmark-subtitle">Field Reporter</span>
        </div>
        <p class="auth-subtitle">Enter your PIN to unlock</p>

        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          onInput={(e) => { setPin((e.target as HTMLInputElement).value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          autoFocus
          class={`pin-input ${error ? "error" : ""}`}
          aria-label="PIN"
        />

        {error && <p class="error-text">{error}</p>}

        <button onClick={handleSubmit} class="btn btn-primary btn-full btn-lg" style={{ marginTop: "var(--sp-4)" }}>
          Unlock
        </button>

        {attempts > 0 && (
          <p class="hint-text" style={{ marginTop: "var(--sp-6)" }}>
            {MAX_ATTEMPTS - attempts} attempts remaining before auto-wipe
          </p>
        )}
      </div>
    </div>
  );
}
