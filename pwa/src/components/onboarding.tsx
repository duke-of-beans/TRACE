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

Before you begin, read through how the system works and what happens with your information.

This takes about 2 minutes.` },
  { title: "Your Data is Scrambled", icon: "lock",
    plain: "If someone got access to your phone, they could not read anything stored by this app. It is all scrambled using your PIN.",
    content: `Everything stored on this device is encrypted with AES-256-GCM. Photos, locations, notes, queued reports.

The encryption key is derived from the PIN you set. Without the PIN, the data on this device is unreadable ciphertext.` },
  { title: "Photos Stay in the App", icon: "camera",
    plain: "Photos you take through TRACE do not appear in your phone's camera roll or photo gallery. Nobody browsing your phone will find them.",
    content: `Photos taken through the TRACE camera go directly from the camera stream into encrypted storage. They are not saved to the device gallery.

The file picker may create gallery copies. Use the camera when possible.` },
  { title: "Works Without Internet", icon: "radio",
    plain: "You can submit reports even when you have no signal. They are saved on your phone and sent automatically when your connection comes back.",
    content: `Reports are encrypted and queued locally when the server is unreachable. They upload automatically when connectivity returns.

Queue count is visible in Settings.` },
  { title: "Emergency Wipe", icon: "alert-triangle",
    plain: "If you ever need to, you can instantly erase everything TRACE has stored on your phone. One button, two taps, gone forever. Nobody can recover it.",
    content: `The Wipe button destroys the encryption key first, making all stored data unreadable, then clears all app storage.

This is on the Report screen (top right) and in Settings. It cannot be undone.` },
  { title: "Automatic Check-In", icon: "clock",
    plain: "The app quietly checks in with the server in the background. If your phone cannot reach the server for 3 days, the app erases itself as a safety precaution.",
    content: `The device contacts the server periodically via background sync. If contact fails for 72 hours, the app clears its data automatically.

If you will be without signal for an extended time, tell your operator beforehand.` },
  { title: "Your Operator", icon: "user",
    plain: "Your chapter operator manages the system but cannot see your real identity. They know you only by your callsign. They can also remotely erase data from your phone if needed.",
    content: `The operator can revoke access or signal a device to clear its data remotely. This fires on the device's next server contact.

The operator works with callsigns only. They do not have access to the identity vault.` },
];

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div class="auth-screen">
      <div class="auth-card" style={{ textAlign: "left", maxWidth: 420 }}>
        <div class="onboarding-dots">
          {STEPS.map((_, i) => (
            <div key={i} class={`onboarding-dot ${i === step ? "active" : i < step ? "done" : ""}`} />
          ))}
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

        {current.plain && (
          <p style={{ fontSize: "var(--text-base)", color: "var(--text)", lineHeight: "var(--leading-relaxed)", marginBottom: "var(--sp-4)", fontWeight: 500 }}>
            {current.plain}
          </p>
        )}

        <div class="onboarding-content">{current.content}</div>

        <div style={{ display: "flex", gap: "var(--sp-3)" }}>
          {step > 0 && (
            <button class="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep((s) => s - 1)}>Back</button>
          )}
          <button class="btn btn-primary" style={{ flex: 2 }} onClick={isLast ? onComplete : () => setStep((s) => s + 1)}>
            {isLast ? "Start Reporting" : "Continue"}
          </button>
        </div>

        <p class="hint-text" style={{ textAlign: "center", marginTop: "var(--sp-4)" }}>
          Step {step + 1} of {STEPS.length}
        </p>
      </div>
    </div>
  );
}
