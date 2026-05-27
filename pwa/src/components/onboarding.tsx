/**
 * TRACE PWA — Security Briefing (post-auth only)
 *
 * Redesigned: visual-first, fixed-height card, pinned nav.
 * Shown AFTER authentication. Bad actors never see this content.
 */
import { useState } from "preact/hooks";
import { Icon } from "./icon.js";

type OnboardingProps = { onComplete: () => void };

const STEPS = [
  {
    icon: "shield", title: "Welcome to TRACE",
    body: "Your chapter uses TRACE to collect and organize vehicle sightings. This quick tour explains how the app protects your information.",
    detail: null,
  },
  {
    icon: "lock", title: "Your data is encrypted",
    body: "Everything stored on your phone is scrambled using your PIN. Without it, nothing is readable.",
    detail: "AES-256-GCM encryption. The key is derived from your PIN via PBKDF2. Without the PIN, stored data is irrecoverable ciphertext.",
  },
  {
    icon: "camera", title: "Photos stay off your camera roll",
    body: "Photos taken through TRACE go straight into encrypted storage. Camera model and device info are stripped automatically.",
    detail: "EXIF metadata (camera make, model, serial, lens data) is destroyed before storage or transmission. GPS and timestamp are preserved for the sighting record only.",
  },
  {
    icon: "radio", title: "Works without a signal",
    body: "No connection? Reports save on your phone and send automatically when you reconnect.",
    detail: "Reports are encrypted and queued in IndexedDB. They upload automatically when connectivity returns. Queue count is visible in Settings.",
  },
  {
    icon: "alert-triangle", title: "Emergency wipe",
    body: "One button, two taps, everything gone. Find it on the Report screen and in Settings.",
    detail: "Wipe destroys the encryption key first (making stored data unreadable), then clears all storage, caches, and service workers. Cannot be undone.",
  },
  {
    icon: "radio", title: "Report harassment",
    body: "Getting harassing calls or texts? Report the number to your operator. They can investigate and let you know what they find.",
    detail: "The Alert tab lets you submit phone numbers and descriptions. Your operator reviews reports and may be able to identify the caller.",
  },
  {
    icon: "clock", title: "Automatic check-in",
    body: "The app contacts the server in the background. If it cannot connect for 3 days, it clears itself as a precaution.",
    detail: "Background sync contacts the server periodically. If contact fails for 72 hours, auto-wipe triggers. Grace period warnings appear before the deadline.",
  },
  {
    icon: "user", title: "You are a callsign, not a name",
    body: "Your operator knows you by your callsign only. Your real identity is encrypted separately and inaccessible during normal operations.",
    detail: "Operators see callsigns only. Real identities are stored in a separate database vault. The operator can revoke access remotely but cannot access your PIN or decrypt your device.",
  },
  {
    icon: "info", title: "Something not working?",
    body: "Tell your operator about any bugs or issues. They can report it, or you can file directly at the link below.",
    detail: "Report issues: github.com/duke-of-beans/TRACE/issues. Include what you were doing, what happened, and what you expected.",
  },
];

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [showDetail, setShowDetail] = useState(false);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const goNext = () => {
    if (isLast) { onComplete(); return; }
    setShowDetail(false);
    setStep(s => s + 1);
  };
  const goBack = () => {
    setShowDetail(false);
    setStep(s => s - 1);
  };

  return (
    <div class="auth-screen">
      <div class="auth-card" style={{
        textAlign: "center", maxWidth: 400, width: "100%",
        height: "min(480px, 80vh)",
        display: "flex", flexDirection: "column",
        padding: "24px",
      }}>
        {/* Icon area */}
        <div style={{
          height: 100, display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          {step === 0 ? (
            <div>
              <span style={{
                fontFamily: "'Exo 2', system-ui, sans-serif",
                fontWeight: 100, fontSize: 36, letterSpacing: "0.22em",
                color: "var(--accent)", display: "block",
              }}>TRACE</span>
              <span style={{ display: "block", height: 1, background: "var(--accent)", opacity: 0.4, marginTop: 6 }}></span>
            </div>
          ) : (
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: "rgba(99,102,241,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--accent)",
            }}>
              <Icon name={current.icon} size={28} />
            </div>
          )}
        </div>

        {/* Content area */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          justifyContent: "flex-start", minHeight: 0,
          textAlign: "center", padding: "0 8px", overflow: "auto",
        }}>
          <h2 style={{
            fontSize: 18, fontWeight: 700,
            marginBottom: 12, color: "var(--text)",
            lineHeight: 1.3,
          }}>{current.title}</h2>

          <p style={{
            fontSize: 14, color: "var(--text-sec)",
            lineHeight: 1.7, marginBottom: 12,
          }}>{current.body}</p>

          {current.detail && (
            <div style={{ marginTop: "auto" }}>
              {!showDetail ? (
                <button onClick={() => setShowDetail(true)} style={{
                  background: "none", border: "none", color: "var(--text-muted)",
                  fontSize: 11, cursor: "pointer", textDecoration: "underline", opacity: 0.7,
                }}>Technical details</button>
              ) : (
                <div style={{
                  fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6,
                  background: "var(--surface-alt, rgba(0,0,0,0.2))",
                  borderRadius: 8, padding: "10px 14px", textAlign: "left",
                }}>
                  {current.detail}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation — PINNED at bottom */}
        <div style={{ flexShrink: 0, paddingTop: 16 }}>
          <div style={{ display: "flex", gap: 12 }}>
            {step > 0 && (
              <button class="btn btn-secondary" style={{ flex: 1 }} onClick={goBack}>Back</button>
            )}
            <button class="btn btn-primary" style={{ flex: step > 0 ? 2 : 1 }} onClick={goNext}>
              {isLast ? "Start Reporting" : "Continue"}
            </button>
          </div>

          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 6, marginTop: 12,
          }}>
            {STEPS.map((_, i) => (
              <div key={i} style={{
                width: i === step ? 16 : 6, height: 6,
                borderRadius: 3,
                background: i === step ? "var(--accent)" : i < step ? "var(--accent)" : "var(--border)",
                opacity: i < step ? 0.4 : 1,
                transition: "width 0.2s, opacity 0.2s",
              }} />
            ))}
            {!isLast && (
              <button onClick={onComplete} style={{
                background: "none", border: "none", color: "var(--text-muted)",
                cursor: "pointer", fontSize: 11, marginLeft: 8, opacity: 0.6,
              }}>skip</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
