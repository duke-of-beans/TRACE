/**
 * TRACE Operator — Security Operations
 *
 * Reporter device management, remote kill controls,
 * security documentation for operators.
 */
import { useState } from "react";
import { useToast, useConfirm, HelpTip } from "../components/ux/index.js";
import { Icon } from "../components/icon.js";

const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem("trace_op_token");
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

export function Security() {
  const [tab, setTab] = useState<"overview" | "devices" | "nuke">("overview");

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Security Operations</h1>

      <div className="flex gap-1 mb-6 bg-trace-bg rounded-lg p-1">
        <TabBtn label="Overview" active={tab === "overview"} onClick={() => setTab("overview")} />
        <TabBtn label="Device Control" active={tab === "devices"} onClick={() => setTab("devices")} />
        <TabBtn label="Emergency" active={tab === "nuke"} onClick={() => setTab("nuke")} />
      </div>

      {tab === "overview" && <SecurityOverview />}
      {tab === "devices" && <DeviceControl />}
      {tab === "nuke" && <EmergencyPanel />}
    </div>
  );
}

function SecurityOverview() {
  return (
    <div className="max-w-2xl space-y-6">
      <DocSection title="Reporter Device Security"
        body={`Each reporter's device encrypts all TRACE data using AES-256-GCM. The encryption key is protected by the reporter's PIN. Without the PIN, the data on the device is irrecoverable ciphertext.

Photos captured through TRACE's camera do not get saved to the device's photo gallery. The offline queue encrypts sighting data before storing it on the device.`} />

      <DocSection title="Remote Kill Capabilities"
        body={`You can remotely wipe a reporter's device through three mechanisms:

• Suspend: Revokes the reporter's sessions. Their app will lose access on next API call. Reversible.
• Kill: Suspends the reporter AND sends a push notification that triggers the app's self-destruct sequence. Also fires on the reporter's next heartbeat check. The device wipes all TRACE data.
• Nuke: Emergency kill for ALL reporters in the chapter simultaneously.

Push-based kill works when the device has any internet connection. If the device is offline, the dead man's switch will fire after the configured check-in window (default 24 hours).`} />

      <DocSection title="Dead Man's Switch"
        body={`Reporter devices are configured with a check-in window (default 24 hours). The app must successfully contact the server within this window. If it cannot, it automatically clears all data.

This protects against a device being seized and kept offline to prevent remote wiping. The check-in window is configurable per chapter. If a reporter plans to be offline (travel, vacation), coordinate with them to either extend their window or pause the requirement temporarily.`} />

      <DocSection title="PIN + Auto-Lock"
        body={`Reporters set a PIN during onboarding. The PIN is required every time the app is opened. The app also auto-locks when:

• The app goes to the background (user switches apps)
• After 5 minutes of inactivity

After 10 incorrect PIN attempts, the app automatically wipes all data. This prevents forced-access scenarios.`} />

      <DocSection title="Three-Vault Architecture"
        body={`TRACE separates data into three cryptographically isolated vaults:

Vault A (Operational): Vehicle data, sightings, actors — all pseudonymous. No real reporter identities. A full dump reveals zero personal information.

Vault B (Identity): Reporter real names, emails, phones — encrypted at rest with a separate key. Only accessible for authentication flows.

Vault C (Evidence): Write-once evidence locker with SHA-256 hash chain. Cannot be modified or deleted. Provides tamper-evident legal-grade evidence integrity.

Each vault uses a separate database role with minimal privileges. The evidence vault physically cannot UPDATE or DELETE records.`} />

      <div className="p-4 bg-trace-surface rounded-lg border border-trace-border">
        <p className="text-xs text-gray-500 leading-relaxed">
          These features are designed to provide reasonable security protections for
          chapter operations. No system can guarantee absolute security in all scenarios.
          Operational security practices, situational awareness, and proper training
          remain essential complements to technical protections.
        </p>
      </div>
    </div>
  );
}

function DeviceControl() {
  const [reporterId, setReporterId] = useState("");
  const toast = useToast();
  const confirm = useConfirm();

  const handleSuspend = async () => {
    if (!reporterId) { toast("Enter a reporter ID", "warning"); return; }
    const ok = await confirm({
      title: "Suspend reporter?",
      message: "This will revoke their sessions and block access. The reporter can be reactivated later.",
      confirmLabel: "Suspend",
    });
    if (!ok) return;
    const res = await fetch(`/api/v1/admin/reporters/${reporterId}/suspend`, { method: "POST", headers: authHeaders() });
    if (res.ok) toast("Reporter suspended", "success");
    else toast("Failed to suspend", "error");
  };

  const handleKill = async () => {
    if (!reporterId) { toast("Enter a reporter ID", "warning"); return; }
    const ok = await confirm({
      title: "Remote kill reporter device?",
      message: "This will suspend the reporter, revoke all sessions, and send a kill signal to their device. The device will wipe all TRACE data on next contact. This is not easily reversible.",
      confirmLabel: "Kill Device",
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/v1/admin/reporters/${reporterId}/kill`, { method: "POST", headers: authHeaders() });
    if (res.ok) toast("Kill signal sent", "success");
    else toast("Failed to send kill", "error");
  };

  const handleReactivate = async () => {
    if (!reporterId) { toast("Enter a reporter ID", "warning"); return; }
    const res = await fetch(`/api/v1/admin/reporters/${reporterId}/reactivate`, { method: "POST", headers: authHeaders() });
    if (res.ok) toast("Reporter reactivated", "success");
    else toast("Failed to reactivate", "error");
  };

  const handleNukeAll = async () => {
    const ok = await confirm({
      title: "Kill ALL reporter devices?",
      message: "This suspends every reporter, revokes all sessions, and pushes a kill signal to every device. All reporter devices will wipe their TRACE data.",
      confirmLabel: "Kill All Devices",
      danger: true,
    });
    if (!ok) return;
    const ok2 = await confirm({
      title: "Are you absolutely sure?",
      message: "This cannot be easily undone. Every reporter will need to be re-onboarded.",
      confirmLabel: "YES — NUKE ALL",
      danger: true,
    });
    if (!ok2) return;
    const res = await fetch("/api/v1/admin/nuke", { method: "POST", headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      toast(`${data.reportersKilled} device(s) killed`, "error");
    } else toast("Nuke failed", "error");
  };

  return (
    <div className="max-w-lg space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="font-semibold">Device Control</h2>
        <HelpTip text="Manage individual reporter device access. Suspend revokes access. Kill wipes the device remotely." />
      </div>

      <input value={reporterId} onChange={(e) => setReporterId(e.target.value)}
        placeholder="Reporter ID (UUID)" className="w-full bg-trace-bg border border-trace-border rounded-lg px-3 py-2 text-sm focus:border-trace-accent focus:outline-none" />

      <div className="flex gap-2">
        <button onClick={handleSuspend} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--warning)", color: "#fff" }}>
          <Icon name="lock" size={14} className="inline mr-1" /> Suspend
        </button>
        <button onClick={handleKill} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--danger)", color: "#fff" }}>
          <Icon name="skull" size={14} className="inline mr-1" /> Kill Device
        </button>
        <button onClick={handleReactivate} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--success)", color: "#fff" }}>
          <Icon name="unlock" size={14} className="inline mr-1" /> Reactivate
        </button>
      </div>

      {/* Nuke All — quick access */}
      <div className="mt-8 pt-6" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2 mb-2">
          <Icon name="alert-triangle" size={16} className="text-trace-danger" />
          <h2 className="font-semibold" style={{ color: "var(--danger)" }}>Kill All Devices</h2>
        </div>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
          Suspend every reporter, revoke all sessions, push kill signal to every device in the chapter.
        </p>
        <button onClick={handleNukeAll}
          className="px-4 py-2 rounded-lg text-sm font-bold" style={{ background: "var(--danger)", color: "#fff" }}>
          <Icon name="skull" size={14} className="inline mr-1" /> Nuke All Devices
        </button>
      </div>
    </div>
  );
}

function EmergencyPanel() {
  const toast = useToast();
  const confirm = useConfirm();

  const handleNuke = async () => {
    const ok = await confirm({
      title: "⚠ EMERGENCY: Kill ALL reporters?",
      message: "This will immediately suspend every reporter in this chapter, revoke all sessions, and send kill signals to every device. All reporter devices will wipe their TRACE data. This affects EVERY reporter. Only use this in a genuine emergency.",
      confirmLabel: "NUKE CHAPTER",
      danger: true,
    });
    if (!ok) return;

    // double confirm for nuke
    const ok2 = await confirm({
      title: "Confirm: Destroy all reporter data?",
      message: "Last chance. This will wipe TRACE from every reporter device in the chapter. Are you absolutely certain?",
      confirmLabel: "YES, NUKE EVERYTHING",
      danger: true,
    });
    if (!ok2) return;

    const res = await fetch("/api/v1/admin/nuke", { method: "POST", headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      toast(`Chapter nuked. ${data.reportersKilled} device(s) killed.`, "error");
    } else {
      toast("Nuke failed", "error");
    }
  };

  return (
    <div className="max-w-lg">
      <div className="p-6 bg-trace-surface rounded-lg border border-trace-danger/30">
        <h2 className="text-lg font-bold text-trace-danger mb-4">Emergency Kill Switch</h2>
        <p className="text-sm text-gray-400 mb-4 leading-relaxed">
          This will immediately suspend every reporter in the chapter, revoke all active sessions,
          and push a kill signal to every device. Reporter devices will wipe all TRACE data
          on next contact. If a device is offline, its dead man's switch will fire after
          the configured check-in window.
        </p>
        <p className="text-sm text-gray-400 mb-6 leading-relaxed">
          Use this only if you believe the chapter's operational security has been
          fundamentally compromised and continued data existence on any device
          represents an unacceptable risk.
        </p>
        <button onClick={handleNuke}
          className="w-full py-3 bg-trace-danger text-white rounded-lg text-sm font-bold hover:opacity-90 transition">
          NUKE CHAPTER
        </button>
      </div>
    </div>
  );
}

function DocSection({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-trace-surface rounded-lg p-5 border border-trace-border">
      <h3 className="text-sm font-semibold text-trace-accent mb-3">{title}</h3>
      <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-line">{body}</p>
    </div>
  );
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`px-4 py-2 rounded-md text-sm transition-colors ${
      active ? "bg-trace-surface text-trace-accent font-medium shadow-sm" : "text-gray-500 hover:text-gray-300"
    }`}>{label}</button>
  );
}
