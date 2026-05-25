/**
 * TRACE PWA — Security Information
 *
 * Always-accessible from Settings. Plain language explanation
 * of every protection mechanism. Legally neutral.
 */

type SecurityInfoProps = {
  ttlHours: number;
  onBack: () => void;
};

export function SecurityInfo({ ttlHours, onBack }: SecurityInfoProps) {
  return (
    <div>
      <button onClick={onBack} style={{
        background: "none", border: "none", color: "#4fc3f7",
        fontSize: 13, cursor: "pointer", marginBottom: 16, padding: 0,
      }}>← Back to Settings</button>

      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>How TRACE Protects You</h2>

      <Section title="Device Encryption"
        body="All data stored on this device is encrypted using AES-256-GCM. Your photos, sighting reports, and queue data are scrambled before being saved. Your PIN protects the encryption key — without it, the data cannot be read, even with physical access to the device." />

      <Section title="Gallery-Free Camera"
        body="When you capture photos through TRACE's camera button, images are taken directly from the camera stream and are not saved to your phone's photo gallery. There are no copies to find or delete. The 'Files' fallback may create gallery copies — use the camera button when possible." />

      <Section title="Offline Queue"
        body="Sighting reports are encrypted and queued on your device when the server isn't reachable. They upload automatically when connectivity is restored. You can see your queue count in Settings. No action is needed from you — the sync happens in the background." />

      <Section title="Emergency Wipe"
        body="The Emergency Wipe in Settings permanently destroys all TRACE data on this device. It works by destroying your encryption key first — making all stored data irrecoverable — then wiping all app storage, caches, and the app itself. Use this if you believe your device may be compromised. This cannot be undone." />

      <Section title={`Check-In Window (${ttlHours} hours)`}
        body={`As a precaution, TRACE requires periodic contact with the server. If this device cannot reach the server for ${ttlHours} hours, the app will automatically clear its data. This protects you if your device is taken and kept offline to prevent remote wiping.\n\nIf you plan to be without signal for an extended period (travel, vacation, remote areas), contact your operator beforehand. They can adjust your window or pause this requirement temporarily.`} />

      <Section title="Remote Protection"
        body="Your chapter operator has the ability to remotely revoke your access and signal this app to clear its data if they believe a device may be compromised. This is a safety measure. The operator cannot access your personal information — they work only with your callsign and operational data." />

      <Section title="PIN Protection"
        body="Your PIN is required every time you open TRACE. The app also locks automatically when you switch to another app or after a period of inactivity. After 10 incorrect PIN attempts, the app will automatically wipe all data as a protection against forced access." />

      <div style={{
        marginTop: 24, padding: 16, background: "#1a1a2e",
        borderRadius: 8, border: "1px solid #2a2a3e",
      }}>
        <p style={{ fontSize: 11, color: "#555", lineHeight: 1.6 }}>
          These features are designed to provide reasonable protections for your information.
          No security system can guarantee absolute protection in all circumstances.
          Always exercise situational awareness and follow your chapter's operational guidelines.
          If you have questions about these protections, contact your chapter operator.
        </p>
      </div>
    </div>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: "#4fc3f7", marginBottom: 6 }}>{title}</h3>
      <p style={{ fontSize: 13, color: "#bbb", lineHeight: 1.6, whiteSpace: "pre-line" }}>{body}</p>
    </div>
  );
}
