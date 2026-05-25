/**
 * TRACE PWA — Onboarding + Security Briefing
 *
 * First-time flow: PIN setup + security education.
 * Explains every protection mechanism in plain language.
 * Legally neutral — describes capabilities without guarantees.
 */
import { useState } from "preact/hooks";
import { setupPIN } from "../lib/app-lock.js";
import { loadDeviceKey } from "../lib/crypto.js";

type OnboardingProps = {
  onComplete: () => void;
};

const STEPS = [
  {
    title: "Welcome to TRACE",
    content: `TRACE is designed to help you report sightings quickly and securely. Before you start, there are a few things you should understand about how this app protects you.

This briefing takes about 2 minutes. Please read it carefully.`,
  },
  {
    title: "Your Data is Encrypted",
    content: `Everything you capture through TRACE — photos, locations, notes — is encrypted on your device before it's stored. This means that even if someone accessed your phone's raw storage, they would find only scrambled data.

Your encryption key is protected by the PIN you'll set up next. Without your PIN, the data on your device cannot be read.`,
  },
  {
    title: "Photos Stay Private",
    content: `When you use TRACE's camera, photos are captured directly from the camera stream and do not get saved to your phone's photo gallery. This means there are no copies of your surveillance photos sitting in your camera roll.

If you use the file picker instead (the "Files" button), your phone may save a copy to the gallery. If you do this, consider deleting it from your gallery afterward.`,
  },
  {
    title: "Offline Queue",
    content: `TRACE works without an internet connection. When you submit a sighting and the server isn't reachable, your report is encrypted and queued on your device. It will automatically upload when connectivity is restored.

You can see how many reports are queued in the Settings tab. The queue syncs automatically — you don't need to do anything.`,
  },
  {
    title: "Emergency Wipe",
    content: `If you ever need to quickly destroy all TRACE data on your device, go to Settings and use the Emergency Wipe button. This permanently destroys your encryption key and all stored data. The app will cease to function.

This is intended for situations where you believe your device may be compromised. Use it only when necessary — it cannot be undone.`,
  },
  {
    title: "Check-In Requirement",
    content: `For your protection, TRACE requires periodic contact with the server. If your device cannot reach the server for an extended period, the app may automatically clear its data as a precaution.

If you know you'll be without signal for an extended time (vacation, travel, remote areas), coordinate with your operator beforehand. They can adjust your check-in window or temporarily pause this requirement.

The current check-in window is shown in your Settings.`,
  },
  {
    title: "Your Operator Can Help",
    content: `Your chapter operator has tools to protect you remotely. If they believe a device may be compromised, they can remotely revoke access and signal the app to clear its data.

This is a safety measure, not surveillance. The operator cannot see your personal data — only your callsign and submission history within the chapter's operational data.`,
  },
];

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [error, setError] = useState("");
  const [setting, setSetting] = useState(false);

  const isLastBriefing = step === STEPS.length - 1;
  const isPinStep = step === STEPS.length;

  const handlePinSubmit = async () => {
    if (pin.length < 4 || pin.length > 6) {
      setError("PIN must be 4-6 digits");
      return;
    }
    if (pin !== pinConfirm) {
      setError("PINs don't match");
      return;
    }
    if (!/^\d+$/.test(pin)) {
      setError("PIN must be numbers only");
      return;
    }

    setSetting(true);
    try {
      const key = await loadDeviceKey();
      if (key) {
        const jwk = await crypto.subtle.exportKey("jwk", key);
        await setupPIN(pin, jwk);
      }
      onComplete();
    } catch (err) {
      setError("Failed to set up PIN. Please try again.");
      setSetting(false);
    }
  };

  if (isPinStep) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 360, margin: "0 auto", width: "100%" }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#4fc3f7", marginBottom: 8 }}>Set Your PIN</h2>
          <p style={{ fontSize: 13, color: "#888", marginBottom: 24, lineHeight: 1.5 }}>
            Your PIN protects the encryption key on this device. You'll enter it each time you open TRACE. Choose something you'll remember but others won't guess.
          </p>

          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            placeholder="4-6 digit PIN"
            value={pin}
            onInput={(e) => { setPin((e.target as HTMLInputElement).value); setError(""); }}
            style={pinInputStyle}
          />
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            placeholder="Confirm PIN"
            value={pinConfirm}
            onInput={(e) => { setPinConfirm((e.target as HTMLInputElement).value); setError(""); }}
            style={{ ...pinInputStyle, marginTop: 12 }}
          />

          {error && <p style={{ color: "#e74c3c", fontSize: 12, marginTop: 8 }}>{error}</p>}

          <button onClick={handlePinSubmit} disabled={setting}
            style={{
              width: "100%", padding: 14, marginTop: 20,
              background: setting ? "#333" : "#4fc3f7",
              color: "#0f0f1a", border: "none", borderRadius: 10,
              fontSize: 16, fontWeight: 700, cursor: setting ? "default" : "pointer",
            }}>
            {setting ? "Setting up..." : "Set PIN & Start"}
          </button>
        </div>
      </div>
    );
  }

  const current = STEPS[step];

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 400, margin: "0 auto", width: "100%" }}>
        {/* Progress dots */}
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 24 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: "50%",
              background: i === step ? "#4fc3f7" : i < step ? "#4fc3f780" : "#2a2a3e",
            }} />
          ))}
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "#2a2a3e",
          }} />
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#4fc3f7", marginBottom: 16 }}>
          {current.title}
        </h2>

        <div style={{ fontSize: 14, color: "#ccc", lineHeight: 1.7, whiteSpace: "pre-line", marginBottom: 32 }}>
          {current.content}
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          {step > 0 && (
            <button onClick={() => setStep((s) => s - 1)}
              style={{
                flex: 1, padding: 12, background: "#1a1a2e",
                border: "1px solid #2a2a3e", borderRadius: 10,
                color: "#888", fontSize: 14, cursor: "pointer",
              }}>Back</button>
          )}
          <button onClick={() => setStep((s) => s + 1)}
            style={{
              flex: 2, padding: 12, background: "#4fc3f7",
              border: "none", borderRadius: 10, color: "#0f0f1a",
              fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}>
            {isLastBriefing ? "Set Up PIN" : "Continue"}
          </button>
        </div>

        <p style={{ fontSize: 11, color: "#555", marginTop: 16, textAlign: "center" }}>
          Step {step + 1} of {STEPS.length + 1}
        </p>
      </div>
    </div>
  );
}

const pinInputStyle: Record<string, string | number> = {
  width: "100%", padding: "14px 16px",
  background: "#1a1a2e", border: "1px solid #2a2a3e",
  borderRadius: 10, color: "#e0e0e0", fontSize: 24,
  textAlign: "center", letterSpacing: 8,
};
