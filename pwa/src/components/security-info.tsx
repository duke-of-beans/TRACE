/**
 * TRACE PWA — Security Information
 */
import { Icon } from "./icon.js";

type SecurityInfoProps = { ttlHours: number; onBack: () => void };

export function SecurityInfo({ ttlHours, onBack }: SecurityInfoProps) {
  return (
    <div>
      <button class="btn btn-ghost" onClick={onBack} style={{ marginBottom: "var(--sp-4)", padding: 0 }}>
        <Icon name="chevron-right" size={16} class="text-accent" style={{ transform: "rotate(180deg)" }} />
        Back to Settings
      </button>

      <h1 class="page-title">How TRACE Protects You</h1>

      <Section title="Device Encryption" icon="shield"
        body="All data stored on this device is encrypted using AES-256-GCM. Your photos, sighting reports, and queue data are scrambled before being saved. Your PIN protects the encryption key — without it, the data cannot be read, even with physical access to the device." />

      <Section title="Gallery-Free Camera" icon="camera"
        body={`When you capture photos through TRACE's camera, images are taken directly from the camera stream and are not saved to your phone's photo gallery. There are no copies to find or delete. The "Files" fallback may create gallery copies — use the camera when possible.`} />

      <Section title="Offline Queue" icon="radio"
        body="Sighting reports are encrypted and queued on your device when the server isn't reachable. They upload automatically when connectivity is restored. You can see your queue count in Settings." />

      <Section title="Emergency Wipe" icon="alert-triangle"
        body="The Emergency Wipe in Settings permanently destroys all TRACE data on this device. It works by destroying your encryption key first — making all stored data irrecoverable — then wiping all app storage, caches, and the app itself. This cannot be undone." />

      <Section title={`Check-In Window (${ttlHours} hours)`} icon="clock"
        body={`As a precaution, TRACE requires periodic contact with the server. If this device cannot reach the server for ${ttlHours} hours, the app will automatically clear its data.\n\nIf you plan to be without signal for an extended period, contact your operator beforehand.`} />

      <Section title="Remote Protection" icon="globe"
        body="Your chapter operator can remotely revoke access and signal this app to clear its data if they believe a device may be compromised. The operator cannot access your personal information — they work only with your callsign and operational data." />

      <Section title="PIN Protection" icon="lock"
        body="Your PIN is required every time you open TRACE. The app also locks when you switch to another app or after inactivity. After 10 incorrect PIN attempts, the app automatically wipes all data." />

      <div class="card" style={{ marginTop: "var(--sp-6)" }}>
        <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", lineHeight: "var(--leading-relaxed)" }}>
          These features are designed to provide reasonable protections for your information. No security system can guarantee absolute protection in all circumstances. Always exercise situational awareness and follow your chapter's operational guidelines.
        </p>
      </div>
    </div>
  );
}

function Section({ title, icon, body }: { title: string; icon: string; body: string }) {
  return (
    <div class="card" style={{ marginBottom: "var(--sp-4)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", marginBottom: "var(--sp-2)" }}>
        <Icon name={icon} size={16} class="text-accent" />
        <h3 style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text)" }}>{title}</h3>
      </div>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-sec)", lineHeight: "var(--leading-relaxed)", whiteSpace: "pre-line" }}>{body}</p>
    </div>
  );
}
