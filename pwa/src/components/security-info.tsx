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

      <h1 class="page-title">How TRACE Works</h1>

      <Section title="Data Scrambling" icon="shield"
        plain="Everything on your phone is scrambled so that only you can read it. If someone took your phone and looked at the raw data, they would see nonsense."
        body="All data on this device is encrypted with AES-256-GCM before it is written to storage. Photos, sighting reports, and queue data are ciphertext at rest. The encryption key is derived from your PIN using PBKDF2. Without the PIN, stored data is unreadable." />

      <Section title="Camera Privacy" icon="camera"
        plain="Photos you take through TRACE never appear in your phone's photo gallery. They go straight into the app's encrypted storage. No copies are left behind."
        body="The camera captures directly from the hardware stream into encrypted storage. Images do not pass through the device gallery. The file picker fallback may write to the gallery. Delete those manually." />

      <Section title="Works Offline" icon="radio"
        plain="No signal? No problem. Your reports are saved on your phone and sent automatically when your internet comes back."
        body="Sighting reports are encrypted and stored locally when the server is unreachable. The queue drains automatically when connectivity returns. Queue count is visible in Settings." />

      <Section title="Emergency Wipe" icon="alert-triangle"
        plain="One button destroys everything. All your data, photos, reports, and the app itself. Nothing can be recovered afterward. Use this if you think your phone might be taken."
        body="Wipe destroys the encryption key first. All stored data becomes unreadable ciphertext. Then it clears all app storage, caches, and service worker registration. The device retains nothing. This cannot be undone." />

      <Section title={`Automatic Check-In (${ttlHours}h)`} icon="clock"
        plain={`The app quietly contacts the server in the background every few hours. If it cannot reach the server for ${ttlHours} hours, it erases itself as a safety measure. If you will be without signal, let your operator know ahead of time.`}
        body={`The device contacts the server periodically via background sync and in-app heartbeat. If server contact fails for ${ttlHours} hours, the app clears its data automatically. The 4 hours before expiry, the app shows a warning.`} />

      <Section title="Remote Erase" icon="globe"
        plain="Your chapter operator can remotely erase the data on your phone if they believe something is wrong. You do not need to do anything. It happens automatically the next time your phone connects."
        body="The operator can revoke access and signal this device to clear its data. The signal fires on the next server contact. If the device is offline, the check-in timer handles it. The operator has access to callsigns and operational data only." />

      <Section title="PIN Lock" icon="lock"
        plain="Your PIN is required every time you open the app. If you switch to another app, TRACE locks after 30 seconds. If someone enters the wrong PIN 10 times, the app erases everything automatically."
        body="PIN is required on every app launch. The app locks after 30 seconds in the background or 5 minutes of inactivity. After 10 incorrect PIN entries, the app wipes automatically." />

      <div class="card" style={{ marginTop: "var(--sp-6)" }}>
        <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", lineHeight: "var(--leading-relaxed)" }}>
          These are specific technical protections. They do not guarantee safety in every situation. Stay aware of your surroundings and follow your chapter's guidelines.
        </p>
      </div>
    </div>
  );
}

function Section({ title, icon, plain, body }: { title: string; icon: string; plain: string; body: string }) {
  return (
    <div class="card" style={{ marginBottom: "var(--sp-4)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", marginBottom: "var(--sp-3)" }}>
        <Icon name={icon} size={16} class="text-accent" />
        <h3 style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text)" }}>{title}</h3>
      </div>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--text)", lineHeight: "var(--leading-relaxed)", marginBottom: "var(--sp-3)" }}>{plain}</p>
      <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", lineHeight: "var(--leading-relaxed)" }}>{body}</p>
    </div>
  );
}
