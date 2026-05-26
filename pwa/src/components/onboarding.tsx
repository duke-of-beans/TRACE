/**
 * TRACE PWA — Onboarding + Security Briefing
 */
import { useState } from "preact/hooks";
import { setupPIN } from "../lib/app-lock.js";
import { loadDeviceKey } from "../lib/crypto.js";
import { Icon } from "./icon.js";

type OnboardingProps = { onComplete: () => void };

const STEPS = [
  { title: "Welcome", icon: "shield",
    content: `TRACE records and organizes vehicle sightings reported by community members. Tracking, Reporting, Analysis, and Community Evidence.

Before you begin, read through how the system works and what it does with your data.

This takes about 2 minutes.` },
  { title: "Device Encryption", icon: "lock",
    content: `Everything stored on this device is encrypted with AES-256-GCM. Photos, locations, notes, queued reports. All of it.

The encryption key is derived from the PIN you set next. Without the PIN, the data on this device is unreadable ciphertext.` },
  { title: "Camera Behavior", icon: "camera",
    content: `Photos taken through the TRACE camera go directly from the camera stream into encrypted storage. They are not saved to the device gallery. No copies exist outside the app.

The file picker may create gallery copies. Use the camera when possible.` },
  { title: "Offline Queue", icon: "radio",
    content: `Reports are encrypted and queued locally when the server is unreachable. They upload automatically when connectivity returns.

Queue count is visible in Settings.` },
  { title: "Emergency Wipe", icon: "alert-triangle",
    content: `The Wipe button destroys the encryption key first, making all stored data unreadable, then clears all app storage. The app stops functioning.

This is on the Report screen (top right) and in Settings. It cannot be undone.` },
  { title: "Check-In Requirement", icon: "clock",
    content: `The device contacts the server periodically in the background. If contact fails for 72 hours, the app clears its data automatically.

If you will be without signal for an extended time, tell your operator beforehand.` },
  { title: "Operator Controls", icon: "user",
    content: `The chapter operator can revoke access or signal a device to clear its data remotely. This fires on the device's next server contact.

The operator works with callsigns only. They do not have access to the identity vault.` },
];

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [error, setError] = useState("");
  const [setting, setSetting] = useState(false);

  const isPinStep = step === STEPS.length;

  const handlePinSubmit = async () => {
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

  if (isPinStep) {
    return (
      <div class="auth-screen">
        <div class="auth-card">
          <div class="wordmark-wrap" style={{ marginBottom: "var(--sp-2)" }}>
            <span class="wordmark wordmark-md" style={{ color: "var(--text)" }}>TRACE</span>
            <span class="wordmark-rule"></span>
          </div>
          <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, marginTop: "var(--sp-3)", marginBottom: "var(--sp-1)" }}>Set Your PIN</h2>
          <p class="auth-subtitle">
            The PIN protects the encryption key on this device. Required every time the app opens.
          </p>
          <input type="password" inputMode="numeric" maxLength={6} placeholder="4 to 6 digit PIN" value={pin}
            onInput={(e) => { setPin((e.target as HTMLInputElement).value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && pinConfirm && handlePinSubmit()}
            class={`pin-input ${error ? "error" : ""}`} autoFocus />
          <input type="password" inputMode="numeric" maxLength={6} placeholder="Confirm PIN" value={pinConfirm}
            onInput={(e) => { setPinConfirm((e.target as HTMLInputElement).value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handlePinSubmit()}
            class="pin-input" style={{ marginTop: "var(--sp-3)" }} />
          {error && <p class="error-text">{error}</p>}
          <button onClick={handlePinSubmit} disabled={setting} class="btn btn-primary btn-full btn-lg" style={{ marginTop: "var(--sp-5)" }}>
            {setting ? "Setting up..." : "Set PIN"}
          </button>
        </div>
      </div>
    );
  }

  const current = STEPS[step];

  return (
    <div class="auth-screen">
      <div class="auth-card" style={{ textAlign: "left", maxWidth: 420 }}>
        <div class="onboarding-dots">
          {STEPS.map((_, i) => (
            <div key={i} class={`onboarding-dot ${i === step ? "active" : i < step ? "done" : ""}`} />
          ))}
          <div class="onboarding-dot" />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", marginBottom: "var(--sp-4)" }}>
          {step === 0 ? (
            <div class="wordmark-wrap">
              <span class="wordmark wordmark-md" style={{ color: "var(--text)" }}>TRACE</span>
              <span class="wordmark-rule"></span>
            </div>
          ) : (
            <>
              <Icon name={current.icon} size={24} class="text-accent" />
              <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700 }}>{current.title}</h2>
            </>
          )}
        </div>

        <div class="onboarding-content">{current.content}</div>

        <div style={{ display: "flex", gap: "var(--sp-3)" }}>
          {step > 0 && (
            <button class="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep((s) => s - 1)}>Back</button>
          )}
          <button class="btn btn-primary" style={{ flex: 2 }} onClick={() => setStep((s) => s + 1)}>
            {step === STEPS.length - 1 ? "Set Up PIN" : "Continue"}
          </button>
        </div>

        <p class="hint-text" style={{ textAlign: "center", marginTop: "var(--sp-4)" }}>
          Step {step + 1} of {STEPS.length + 1}
        </p>
      </div>
    </div>
  );
}
