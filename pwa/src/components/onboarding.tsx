/**
 * TRACE PWA — Security Briefing (post-auth only)
 *
 * Shown AFTER authentication. Bad actors never see this content.
 * PIN setup is handled separately by pin-setup.tsx before auth.
 */
import { useState } from "preact/hooks";
import { Icon } from "./icon.js";

type OnboardingProps = { onComplete: () => void };

const STEPS = [
  { title: "Welcome", icon: "shield",
    content: `TRACE records and organizes vehicle sightings reported by community members. Tracking, Reporting, Analysis, and Community Evidence.

Here is a quick overview of how the app works and what it does with your information. Takes about a minute.` },
  { title: "Everything is Encrypted", icon: "lock",
    plain: "All data on your phone is scrambled using your PIN. If someone picked up your phone, they could not read anything stored by this app without the PIN.",
    content: `AES-256-GCM encryption. The key is derived from your PIN. Without the PIN, stored data is unreadable.` },
  { title: "Photos Stay Private", icon: "camera",
    plain: "Photos taken through TRACE do not appear in your camera roll. Identifying information like camera model and device serial number is automatically stripped before anything is stored or sent.",
    content: `Photos go from the camera stream directly into encrypted storage. EXIF metadata (camera make, model, serial, lens data) is destroyed. GPS and timestamp are preserved for the sighting record.` },
  { title: "Works Offline", icon: "radio",
    plain: "No signal? No problem. Reports are saved on your phone and sent automatically when your connection comes back. You can see queued reports in Settings.",
    content: `Reports are encrypted and queued locally. They upload automatically when connectivity returns. Queue count is visible in Settings.` },
  { title: "Emergency Wipe", icon: "alert-triangle",
    plain: "If you ever need to, you can erase everything TRACE has stored on your phone. One button, two taps, gone. The button is on the Report screen and in Settings.",
    content: `Wipe destroys the encryption key first (making stored data unreadable), then clears all storage. This cannot be undone.` },
  { title: "Automatic Check-In", icon: "clock",
    plain: "The app checks in with the server in the background. If your phone cannot reach the server for 3 days, the app clears its data as a precaution. If you will be without signal, let your operator know beforehand.",
    content: `Background sync contacts the server periodically. If contact fails for 72 hours, auto-wipe triggers. Grace period warnings appear before the deadline.` },
  { title: "Your Callsign", icon: "user",
    plain: "Your operator knows you by a callsign, not your real name. Your callsign was assigned when you received your invite code. Your real identity is encrypted separately and is not accessible during normal operations. Your PIN is yours alone. Do not share it with anyone.",
    content: `Operators see callsigns only. Real identities are encrypted in a separate vault. The operator can revoke access or signal a device to clear its data remotely, but cannot access your PIN or decrypt your device.` },
];

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div class="auth-screen">
      <div class="auth-card" style={{
        textAlign: "left", maxWidth: 420,
        height: "min(520px, 80vh)",
        display: "flex", flexDirection: "column",
      }}>
        {/* Dots — fixed at top */}
        <div class="onboarding-dots" style={{ flexShrink: 0 }}>
          {STEPS.map((_, i) => (
            <div key={i} class={`onboarding-dot ${i === step ? "active" : i < step ? "done" : ""}`} />
          ))}
        </div>

        {/* Content — scrolls */}
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, paddingRight: "var(--sp-1)" }}>
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

          {current.plain && (
            <p style={{ fontSize: "var(--text-base)", color: "var(--text)", lineHeight: "var(--leading-relaxed)", marginBottom: "var(--sp-4)", fontWeight: 500 }}>
              {current.plain}
            </p>
          )}

          <div class="onboarding-content">{current.content}</div>
        </div>

        {/* Navigation — pinned at bottom */}
        <div style={{ flexShrink: 0, paddingTop: "var(--sp-4)" }}>
          <div style={{ display: "flex", gap: "var(--sp-3)" }}>
            {step > 0 && (
              <button class="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep((s) => s - 1)}>Back</button>
            )}
            <button class="btn btn-primary" style={{ flex: 2 }} onClick={isLast ? onComplete : () => setStep((s) => s + 1)}>
              {isLast ? "Start Reporting" : "Continue"}
            </button>
          </div>
          <p class="hint-text" style={{ textAlign: "center", marginTop: "var(--sp-3)" }}>
            Step {step + 1} of {STEPS.length}
            {!isLast && (
              <span> · <button onClick={onComplete} style={{
                background: "none", border: "none", color: "var(--text-muted)",
                cursor: "pointer", fontSize: "inherit", textDecoration: "underline",
                opacity: 0.7,
              }}>skip</button></span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
