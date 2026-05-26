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

      <h1 class="page-title">System Architecture</h1>

      <Section title="Device Encryption" icon="shield"
        body="All data on this device is encrypted with AES-256-GCM before it is written to storage. Photos, sighting reports, and queue data are ciphertext at rest. The encryption key is derived from your PIN using PBKDF2. Without the PIN, stored data is unreadable." />

      <Section title="Camera" icon="camera"
        body="The camera captures directly from the hardware stream into encrypted storage. Images do not pass through the device gallery. No copies are created outside the app. The file picker fallback may write to the gallery. Delete those manually." />

      <Section title="Offline Queue" icon="radio"
        body="Sighting reports are encrypted and stored locally when the server is unreachable. The queue drains automatically when connectivity returns. Queue count is visible in Settings." />

      <Section title="Emergency Wipe" icon="alert-triangle"
        body="Wipe destroys the encryption key first. All stored data becomes unreadable ciphertext. Then it clears all app storage, caches, and service worker registration. The device retains nothing. This cannot be undone." />

      <Section title={`Check-In (${ttlHours} hours)`} icon="clock"
        body={`The device contacts the server periodically via background sync and in-app heartbeat. If server contact fails for ${ttlHours} hours, the app clears its data automatically.\n\nThe 4 hours before expiry, the app shows a warning. If you will be without signal, coordinate with your operator to extend the window.`} />

      <Section title="Remote Controls" icon="globe"
        body="The operator can revoke access and signal this device to clear its data. The signal fires on the next server contact. If the device is offline, the check-in timer handles it. The operator has access to callsigns and operational data only. They cannot read the identity vault." />

      <Section title="PIN Lock" icon="lock"
        body="PIN is required every time the app opens. The app locks after 30 seconds in the background or 5 minutes of inactivity. After 10 incorrect PIN entries, the app wipes automatically." />

      <div class="card" style={{ marginTop: "var(--sp-6)" }}>
        <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", lineHeight: "var(--leading-relaxed)" }}>
          These mechanisms provide specific technical protections. They do not guarantee safety in all circumstances. Operational awareness and chapter guidelines remain necessary.
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
