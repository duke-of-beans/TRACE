/**
 * TRACE PWA — PIN Setup (first time only, pre-auth)
 * Minimal. No security details. Just set a PIN.
 */
import { useState } from "preact/hooks";
import { setupPIN } from "../lib/app-lock.js";
import { loadDeviceKey } from "../lib/crypto.js";
import { Icon } from "./icon.js";

type PinSetupProps = { onComplete: () => void };

export function PinSetup({ onComplete }: PinSetupProps) {
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [error, setError] = useState("");
  const [setting, setSetting] = useState(false);

  const handleSubmit = async () => {
    if (pin.length < 4 || pin.length > 6) { setError("PIN must be 4 to 6 digits"); return; }
    if (pin !== pinConfirm) { setError("PINs do not match"); return; }
    if (!/^\d+$/.test(pin)) { setError("PIN must be numbers only"); return; }
    setSetting(true);
    try {
      const key = await loadDeviceKey();
      if (key) {
        const jwk = await crypto.subtle.exportKey("jwk", key);
        await setupPIN(pin, jwk);
      }
      onComplete();
    } catch {
      setError("PIN setup failed. Try again.");
      setSetting(false);
    }
  };

  return (
    <div class="auth-screen">
      <div class="auth-card">
        <div class="wordmark-wrap" style={{ marginBottom: "var(--sp-2)" }}>
          <span class="wordmark wordmark-lg">TRACE</span>
          <span class="wordmark-rule"></span>
          <span class="wordmark-expansion">Tracking · Reporting · Analysis · Community Evidence</span>
          <span class="wordmark-subtitle">Field Reporter</span>
        </div>
        <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, marginTop: "var(--sp-3)", marginBottom: "var(--sp-1)" }}>Set Your PIN</h2>
        <p class="auth-subtitle">
          Pick a 4 to 6 digit PIN. You will enter this every time you open the app.
        </p>
        <input type="password" inputMode="numeric" maxLength={6} placeholder="4 to 6 digit PIN" value={pin}
          onInput={(e) => { setPin((e.target as HTMLInputElement).value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && pinConfirm && handleSubmit()}
          class={`pin-input ${error ? "error" : ""}`} autoFocus />
        <input type="password" inputMode="numeric" maxLength={6} placeholder="Confirm PIN" value={pinConfirm}
          onInput={(e) => { setPinConfirm((e.target as HTMLInputElement).value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          class="pin-input" style={{ marginTop: "var(--sp-3)" }} />
        {error && <p class="error-text">{error}</p>}
        <button onClick={handleSubmit} disabled={setting} class="btn btn-primary btn-full btn-lg" style={{ marginTop: "var(--sp-5)" }}>
          {setting ? "Setting up..." : "Set PIN"}
        </button>
      </div>
    </div>
  );
}
