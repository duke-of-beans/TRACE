/**
 * TRACE PWA — Onboarding + Security Briefing
 */
import { useState } from "preact/hooks";
import { setupPIN } from "../lib/app-lock.js";
import { loadDeviceKey } from "../lib/crypto.js";
import { Icon } from "./icon.js";

type OnboardingProps = { onComplete: () => void };

const STEPS = [
  { title: "Welcome to TRACE", icon: "shield",
    content: `TRACE is designed to help you report sightings quickly and securely. Before you start, there are a few things you should understand about how this app protects you.\n\nThis briefing takes about 2 minutes. Please read it carefully.` },
  { title: "Your Data is Encrypted", icon: "lock",
    content: `Everything you capture through TRACE — photos, locations, notes — is encrypted on your device before it's stored. This means that even if someone accessed your phone's raw storage, they would find only scrambled data.\n\nYour encryption key is protected by the PIN you'll set up next. Without your PIN, the data on your device cannot be read.` },
  { title: "Photos Stay Private", icon: "camera",
    content: `When you use TRACE's camera, photos are captured directly from the camera stream and do not get saved to your phone's photo gallery. This means there are no copies of your surveillance photos sitting in your camera roll.\n\nIf you use the file picker instead, your phone may save a copy to the gallery. Delete it afterward.` },
  { title: "Offline Queue", icon: "radio",
    content: `TRACE works without an internet connection. When you submit a sighting and the server isn't reachable, your report is encrypted and queued on your device. It will automatically upload when connectivity is restored.\n\nYou can see how many reports are queued in the Settings tab.` },
  { title: "Emergency Wipe", icon: "alert-triangle",
    content: `If you ever need to quickly destroy all TRACE data on your device, go to Settings and use the Emergency Wipe button. This permanently destroys your encryption key and all stored data. The app will cease to function.\n\nThis is intended for situations where you believe your device may be compromised. Use it only when necessary — it cannot be undone.` },
  { title: "Check-In Requirement", icon: "clock",
    content: `For your protection, TRACE requires periodic contact with the server. If your device cannot reach the server for an extended period, the app may automatically clear its data as a precaution.\n\nIf you know you'll be without signal for an extended time (vacation, travel, remote areas), coordinate with your operator beforehand.` },
  { title: "Your Operator Can Help", icon: "user",
    content: `Your chapter operator has tools to protect you remotely. If they believe a device may be compromised, they can remotely revoke access and signal the app to clear its data.\n\nThis is a safety measure, not surveillance. The operator cannot see your personal data — only your callsign and submission history within the chapter's operational data.` },
];

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [error, setError] = useState("");
  const [setting, setSetting] = useState(false);

  const isPinStep = step === STEPS.length;

  const handlePinSubmit = async () => {
    if (pin.length < 4 || pin.length > 6) { setError("PIN must be 4–6 digits"); return; }
    if (pin !== pinConfirm) { setError("PINs don't match"); return; }
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
      setError("Failed to set up PIN. Please try again.");
      setSetting(false);
    }
  };

  if (isPinStep) {
    return (
      <div class="auth-screen">
        <div class="auth-card">
          <h1 class="auth-title">Set Your PIN</h1>
          <p class="auth-subtitle">
            Your PIN protects the encryption key on this device. You'll enter it each time you open TRACE.
          </p>
          <input type="password" inputMode="numeric" maxLength={6} placeholder="4–6 digit PIN" value={pin}
            onInput={(e) => { setPin((e.target as HTMLInputElement).value); setError(""); }}
            class={`pin-input ${error ? "error" : ""}`} />
          <input type="password" inputMode="numeric" maxLength={6} placeholder="Confirm PIN" value={pinConfirm}
            onInput={(e) => { setPinConfirm((e.target as HTMLInputElement).value); setError(""); }}
            class="pin-input" style={{ marginTop: "var(--sp-3)" }} />
          {error && <p class="error-text">{error}</p>}
          <button onClick={handlePinSubmit} disabled={setting} class="btn btn-primary btn-full btn-lg" style={{ marginTop: "var(--sp-5)" }}>
            {setting ? "Setting up..." : "Set PIN & Start"}
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
          <Icon name={current.icon} size={24} class="text-accent" />
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700 }}>{current.title}</h2>
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
