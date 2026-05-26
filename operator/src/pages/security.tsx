/**
 * TRACE Operator — Security Operations
 *
 * Reporter device management, remote kill controls,
 * security documentation for operators.
 */
import { useState } from "react";
import { useToast, useConfirm, HelpTip } from "../components/ux/index.js";
import { Icon } from "../components/icon.js";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3100/api/v1";
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
        plain="Every reporter's phone encrypts all TRACE data so it cannot be read without their PIN. Photos taken through the app never appear in the phone's gallery. All identifying metadata (camera model, device serial number) is stripped from photos before they are stored or sent."
        body={`AES-256-GCM encryption. Key derived from PIN via PBKDF2. Photos captured via getUserMedia bypass the gallery. Uploaded files are re-encoded through a canvas scrubber that destroys all EXIF metadata except GPS and timestamp.`} />

      <DocSection title="Remote Kill Capabilities"
        plain="You can remotely erase TRACE data from any reporter's phone. Suspend blocks their access (reversible). Kill erases their device on next server contact. Nuke erases every device in the chapter at once."
        body={`Suspend: revokes sessions, blocks API access. Reversible.
Kill: suspends + pushes kill signal via web-push and heartbeat. Device clears all data on next contact.
Nuke: suspends all reporters, revokes all sessions, pushes kill to all devices. Double-confirmed.`} />

      <DocSection title="Dead Man's Switch"
        plain="Reporter phones automatically check in with the server in the background. If a phone cannot reach the server for 72 hours, it erases itself. This prevents someone from seizing a phone and keeping it offline to avoid a remote wipe."
        body={`Default check-in window: 72 hours. Background sync via Service Worker periodic sync (6h interval). In-app heartbeat every 5 minutes. 4-hour grace period with warnings before auto-wipe. If a reporter will be offline, coordinate to avoid unintended wipe.`} />

      <DocSection title="PIN + Auto-Lock"
        plain="Reporters set a PIN during setup. It is required every time the app opens. If the phone switches to another app, TRACE locks after 30 seconds. After 10 wrong PIN attempts, the app erases everything."
        body={`PIN required on every app launch. Auto-lock: 30 seconds background, 5 minutes inactivity. 10 incorrect attempts triggers automatic data wipe.`} />

      <DocSection title="Photo Metadata Scrubbing"
        plain="Every photo that passes through TRACE has its identifying information removed. Camera make, model, serial number, device ID, lens data, and software version are all destroyed. Only GPS coordinates and timestamp are preserved because they have operational value."
        body={`Re-encoding via canvas produces a new JPEG with zero EXIF data. For uploaded files, GPS and timestamp are extracted before scrubbing. The scrubbed image is a clean re-encode with no MakerNote, no ICC profile, no thumbnail, no device fingerprint.`} />

      <DocSection title="Three-Vault Architecture"
        plain="Data is split into three separate locked databases. Operational data (vehicles, sightings) is in one. Reporter identities are in a second with a different key. Evidence is in a third that can only be added to, never changed or deleted. If one database is breached, the others stay locked."
        body={`Vault A (Operational): pseudonymous. Zero reporter identities.
Vault B (Identity): encrypted at rest, separate key.
Vault C (Evidence): write-once, SHA-256 hash chain, append-only.
Each vault uses a separate database role with minimal privileges.`} />

      <div className="p-4 bg-trace-surface rounded-lg border border-trace-border">
        <p className="text-xs text-gray-500 leading-relaxed">
          These mechanisms provide specific technical protections. They do not
          guarantee safety in all circumstances. Operational awareness, situational
          judgment, and chapter guidelines remain necessary.
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
    const res = await fetch(`${API_BASE}/admin/reporters/${reporterId}/suspend`, { method: "POST", headers: authHeaders() });
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
    const res = await fetch(`${API_BASE}/admin/reporters/${reporterId}/kill`, { method: "POST", headers: authHeaders() });
    if (res.ok) toast("Kill signal sent", "success");
    else toast("Failed to send kill", "error");
  };

  const handleReactivate = async () => {
    if (!reporterId) { toast("Enter a reporter ID", "warning"); return; }
    const res = await fetch(`${API_BASE}/admin/reporters/${reporterId}/reactivate`, { method: "POST", headers: authHeaders() });
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
    const res = await fetch(`${API_BASE}/admin/nuke`, { method: "POST", headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      toast(`${data.reportersKilled} device(s) killed`, "error");
    } else toast("Nuke failed", "error");
  };

  return (
    <div className="max-w-lg space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="font-semibold">Device Control</h2>
        <HelpTip text="Enter a reporter ID to manage their device. Find IDs in Admin > Reporters." />
      </div>
      <p className="text-sm mb-3" style={{ color: "var(--text-sec)" }}>
        Suspend blocks a reporter's access (reversible). Kill erases their device on next server contact. Find reporter IDs in the Admin panel under Reporters.
      </p>

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

    const res = await fetch(`${API_BASE}/admin/nuke`, { method: "POST", headers: authHeaders() });
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
        <p className="text-sm mb-4 leading-relaxed" style={{ color: "var(--text)" }}>
          This button erases TRACE from every reporter's phone in the chapter. All at once. Every reporter will need a new invite code to rejoin. Only use this if you believe the entire chapter is compromised.
        </p>
        <p className="text-xs mb-4 leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Suspends all reporters, revokes all sessions, pushes kill signal to every device.
          Offline devices are handled by the 72-hour check-in timer.
        </p>
        <button onClick={handleNuke}
          className="w-full py-3 bg-trace-danger text-white rounded-lg text-sm font-bold hover:opacity-90 transition">
          NUKE CHAPTER
        </button>
      </div>
    </div>
  );
}

function DocSection({ title, plain, body }: { title: string; plain?: string; body: string }) {
  return (
    <div className="bg-trace-surface rounded-lg p-5 border border-trace-border">
      <h3 className="text-sm font-semibold text-trace-accent mb-3">{title}</h3>
      {plain && <p className="text-sm mb-3 leading-relaxed" style={{ color: "var(--text)", fontWeight: 500 }}>{plain}</p>}
      <p className="text-xs leading-relaxed whitespace-pre-line" style={{ color: "var(--text-muted)" }}>{body}</p>
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
