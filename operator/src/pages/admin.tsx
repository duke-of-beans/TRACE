/**
 * TRACE Operator — Admin Panel
 *
 * Full CRUD for chapter configuration:
 * - Vehicle types with color pickers
 * - Suspicion levels with colors and rank
 * - Actor risk levels
 * - Reporter management
 * - Notification channels
 */
import { useState, useEffect } from "react";
import { api } from "../lib/api.js";
import { useToast, useConfirm, HelpTip, SkeletonList, EmptyState } from "../components/ux/index.js";

const PRESET_COLORS = [
  "#e74c3c", "#e67e22", "#f39c12", "#f1c40f",
  "#27ae60", "#2ecc71", "#1abc9c", "#3498db",
  "#4fc3f7", "#9b59b6", "#8e44ad", "#95a5a6",
];

export function Admin() {
  const [tab, setTab] = useState<"reporters" | "types" | "levels" | "risk" | "channels">("types");
  const toast = useToast();

  const TABS = [
    { key: "types" as const,     label: "Vehicle Types",    help: "Operational roles like Runner, Scout, Stash, Decoy" },
    { key: "levels" as const,    label: "Suspicion Levels", help: "Graduated evidence ladder for tracked vehicles" },
    { key: "risk" as const,      label: "Risk Levels",      help: "Danger classification for known actors" },
    { key: "reporters" as const, label: "Reporters",        help: "Manage field reporter accounts" },
    { key: "channels" as const,  label: "Notifications",    help: "Push notification channel topology" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Administration</h1>

      <div className="flex gap-1 mb-6 bg-trace-bg rounded-lg p-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm transition-colors ${
              tab === t.key
                ? "bg-trace-surface text-trace-accent font-medium shadow-sm"
                : "text-gray-500 hover:text-gray-300"
            }`}
            title={t.help}
          >{t.label}</button>
        ))}
      </div>

      {tab === "types"     && <VehicleTypesAdmin />}
      {tab === "levels"    && <SuspicionLevelsAdmin />}
      {tab === "risk"      && <RiskLevelsAdmin />}
      {tab === "reporters" && <ReportersAdmin />}
      {tab === "channels"  && <ChannelsAdmin />}
    </div>
  );
}

// ============ Vehicle Types CRUD ============
function VehicleTypesAdmin() {
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newColor, setNewColor] = useState("#4fc3f7");
  const toast = useToast();

  useEffect(() => {
    api.getVehicleTypes()
      .then((t) => setTypes(Array.isArray(t) ? t : []))
      .catch(() => toast("Failed to load vehicle types", "error"))
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async () => {
    if (!newLabel.trim()) { toast("Label is required", "warning"); return; }
    try {
      const vt = await fetch("/api/v1/admin/vehicle-types", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("trace_op_token")}` },
        body: JSON.stringify({ label: newLabel, description: newDesc, color: newColor }),
      }).then((r) => r.json());
      setTypes((t) => [...t, vt]);
      setNewLabel(""); setNewDesc(""); setNewColor("#4fc3f7"); setAdding(false);
      toast(`Vehicle type "${newLabel}" created`, "success");
    } catch { toast("Failed to create type", "error"); }
  };

  if (loading) return <SkeletonList count={4} />;

  return (
    <div className="max-w-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">Vehicle Types</h2>
          <HelpTip text="Operational roles assigned to vehicles. Chapter-scoped and fully editable." />
        </div>
        <button onClick={() => setAdding(true)} className="text-xs bg-trace-accent text-trace-bg px-3 py-1.5 rounded-lg font-semibold">+ Add</button>
      </div>

      <div className="space-y-2">
        {types.map((t) => (
          <div key={t.id} className="flex items-center gap-3 p-3 bg-trace-surface rounded-lg border border-trace-border">
            <div className="w-4 h-4 rounded-full flex-shrink-0 border border-white/20" style={{ background: t.color }} />
            <div className="flex-1">
              <span className="font-medium text-sm">{t.label}</span>
              {t.description && <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>}
            </div>
          </div>
        ))}
      </div>

      {adding && (
        <div className="mt-4 p-4 bg-trace-surface rounded-lg border border-trace-accent/30">
          <h3 className="text-sm font-semibold mb-3">New Vehicle Type</h3>
          <div className="space-y-3">
            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Label (e.g. Runner)" className={inputCls} />
            <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Description" className={inputCls} />
            <ColorPicker value={newColor} onChange={setNewColor} />
            <div className="flex gap-2">
              <button onClick={handleAdd} className="bg-trace-accent text-trace-bg px-3 py-1.5 rounded-lg text-sm font-semibold">Create</button>
              <button onClick={() => setAdding(false)} className="text-gray-400 px-3 py-1.5 text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Suspicion Levels CRUD ============
function SuspicionLevelsAdmin() {
  const [levels, setLevels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newRank, setNewRank] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newColor, setNewColor] = useState("#3498db");
  const toast = useToast();

  useEffect(() => {
    api.getSuspicionLevels()
      .then((l) => setLevels(Array.isArray(l) ? l.sort((a: any, b: any) => a.rank - b.rank) : []))
      .catch(() => toast("Failed to load suspicion levels", "error"))
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async () => {
    if (!newLabel.trim() || !newRank) { toast("Label and rank are required", "warning"); return; }
    try {
      const level = await fetch("/api/v1/admin/suspicion-levels", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("trace_op_token")}` },
        body: JSON.stringify({ label: newLabel, rank: parseInt(newRank), description: newDesc, color: newColor }),
      }).then((r) => r.json());
      setLevels((l) => [...l, level].sort((a, b) => a.rank - b.rank));
      setNewLabel(""); setNewRank(""); setNewDesc(""); setNewColor("#3498db"); setAdding(false);
      toast(`Suspicion level "${newLabel}" created`, "success");
    } catch { toast("Failed to create level", "error"); }
  };

  if (loading) return <SkeletonList count={5} />;

  return (
    <div className="max-w-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">Suspicion Ladder</h2>
          <HelpTip text="Graduated levels from 'Noticed' to 'Active Criminal'. Vehicles are promoted based on configurable criteria." />
        </div>
        <button onClick={() => setAdding(true)} className="text-xs bg-trace-accent text-trace-bg px-3 py-1.5 rounded-lg font-semibold">+ Add</button>
      </div>

      <div className="space-y-2">
        {levels.map((l, i) => (
          <div key={l.id} className="flex items-center gap-3 p-3 bg-trace-surface rounded-lg border border-trace-border">
            <div className="w-4 h-4 rounded-full flex-shrink-0 border border-white/20" style={{ background: l.color }} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{l.label}</span>
                <span className="text-[10px] text-gray-600 bg-trace-bg px-1.5 py-0.5 rounded">rank {l.rank}</span>
              </div>
              {l.description && <p className="text-xs text-gray-500 mt-0.5">{l.description}</p>}
            </div>
            {i > 0 && <div className="text-gray-600 text-xs">↑</div>}
          </div>
        ))}
      </div>

      {adding && (
        <div className="mt-4 p-4 bg-trace-surface rounded-lg border border-trace-accent/30">
          <h3 className="text-sm font-semibold mb-3">New Suspicion Level</h3>
          <div className="space-y-3">
            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Label" className={inputCls} />
            <input value={newRank} onChange={(e) => setNewRank(e.target.value)} placeholder="Rank (0=retired, 1=lowest)" type="number" className={inputCls} />
            <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Description" className={inputCls} />
            <ColorPicker value={newColor} onChange={setNewColor} />
            <div className="flex gap-2">
              <button onClick={handleAdd} className="bg-trace-accent text-trace-bg px-3 py-1.5 rounded-lg text-sm font-semibold">Create</button>
              <button onClick={() => setAdding(false)} className="text-gray-400 px-3 py-1.5 text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Risk Levels (simplified) ============
function RiskLevelsAdmin() {
  const toast = useToast();
  const riskLevels = [
    { label: "Unknown", severity: 0, color: "#95a5a6", description: "Risk not yet assessed" },
    { label: "Low", severity: 1, color: "#3498db", description: "No known aggressive behavior" },
    { label: "Aggressive", severity: 2, color: "#e67e22", description: "Known aggressive behavior" },
    { label: "Stalker", severity: 3, color: "#e74c3c", description: "Will follow spotters" },
  ];

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-semibold">Actor Risk Levels</h2>
        <HelpTip text="Danger classification for known actors. Higher severity = more caution required." />
      </div>
      <div className="space-y-2">
        {riskLevels.map((r) => (
          <div key={r.label} className="flex items-center gap-3 p-3 bg-trace-surface rounded-lg border border-trace-border">
            <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: r.color }} />
            <div className="flex-1">
              <span className="font-medium text-sm">{r.label}</span>
              <p className="text-xs text-gray-500 mt-0.5">{r.description}</p>
            </div>
            <span className="text-[10px] text-gray-600 bg-trace-bg px-1.5 py-0.5 rounded">sev {r.severity}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ Reporters ============
function ReportersAdmin() {
  const [invite, setInvite] = useState({ callsign: "", email: "", realName: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const handleInvite = async () => {
    if (!invite.callsign || !invite.email) { toast("Callsign and email are required", "warning"); return; }
    setSaving(true);
    try {
      await api.inviteReporter(invite);
      toast(`Reporter "${invite.callsign}" invited`, "success");
      setInvite({ callsign: "", email: "", realName: "", phone: "" });
    } catch { toast("Failed to invite reporter", "error"); }
    setSaving(false);
  };

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-semibold">Invite Reporter</h2>
        <HelpTip text="Creates a pseudonymous reporter in Vault A and an identity record in Vault B. Real identity is encrypted at rest." />
      </div>
      <div className="bg-trace-surface rounded-lg p-5 border border-trace-border space-y-3">
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">Callsign *</label>
          <input value={invite.callsign} onChange={(e) => setInvite((i) => ({ ...i, callsign: e.target.value }))}
            className={inputCls} placeholder="Operational pseudonym (visible in Vault A)" />
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">Email *</label>
          <input value={invite.email} onChange={(e) => setInvite((i) => ({ ...i, email: e.target.value }))}
            className={inputCls} placeholder="For magic link login" />
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">
            Real Name <span className="text-gray-600 normal-case">(encrypted in Vault B)</span>
          </label>
          <input value={invite.realName} onChange={(e) => setInvite((i) => ({ ...i, realName: e.target.value }))}
            className={inputCls} placeholder="Never visible in operational data" />
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">
            Phone <span className="text-gray-600 normal-case">(encrypted in Vault B)</span>
          </label>
          <input value={invite.phone} onChange={(e) => setInvite((i) => ({ ...i, phone: e.target.value }))}
            className={inputCls} placeholder="Optional" />
        </div>
        <button onClick={handleInvite} disabled={saving}
          className="bg-trace-accent text-trace-bg px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 mt-1">
          {saving ? "Inviting..." : "Send Invite"}
        </button>
      </div>
    </div>
  );
}

// ============ Notification Channels ============
function ChannelsAdmin() {
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    api.getChannels()
      .then((c) => setChannels(Array.isArray(c) ? c : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonList count={3} />;

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-semibold">Notification Channels</h2>
        <HelpTip text="Admin-controlled notification topology. Reporters and operators are assigned to channels by admin." />
      </div>
      {channels.length === 0 ? (
        <EmptyState icon="🔔" title="No channels configured" description="Create notification channels to alert reporters and operators when events occur." />
      ) : (
        <div className="space-y-2">
          {channels.map((ch) => (
            <div key={ch.id} className="p-3 bg-trace-surface rounded-lg border border-trace-border">
              <span className="font-medium text-sm">{ch.label}</span>
              {ch.description && <p className="text-xs text-gray-500 mt-0.5">{ch.description}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ Shared Components ============
function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div>
      <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">Color</label>
      <div className="flex items-center gap-2 flex-wrap">
        {PRESET_COLORS.map((c) => (
          <button key={c} onClick={() => onChange(c)}
            className="w-7 h-7 rounded-md border-2 transition-transform hover:scale-110"
            style={{
              background: c,
              borderColor: value === c ? "#fff" : "transparent",
              transform: value === c ? "scale(1.15)" : undefined,
            }}
          />
        ))}
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
          className="w-7 h-7 rounded cursor-pointer border-0 p-0" title="Custom color" />
      </div>
    </div>
  );
}

const inputCls = "w-full bg-trace-bg border border-trace-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-trace-accent focus:outline-none transition-colors placeholder:text-gray-600";
