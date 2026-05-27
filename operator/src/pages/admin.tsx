/**
 * TRACE Operator — Admin Panel
 *
 * Full CRUD with dependency checking for:
 * - Vehicle types (edit label, description, color; delete with dependency check)
 * - Suspicion levels (edit, delete, configure promotion predicates)
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

const PREDICATE_TYPES = [
  { value: "sighting_count", label: "Sighting count", fields: ["operator", "value", "window_days"] },
  { value: "has_driver", label: "Has identified driver", fields: [] },
  { value: "has_type", label: "Has assigned type", fields: [] },
  { value: "plate_swap_count", label: "Plate swap count", fields: ["operator", "value"] },
];

const inputCls = "w-full bg-trace-bg border border-trace-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-trace-accent focus:outline-none transition-colors placeholder:text-gray-600";

const API_BASE = import.meta.env.VITE_API_URL || "/api/v1";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("trace_op_token");
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${API_BASE}/admin${path}`, { ...opts, headers: { ...authHeaders(), ...opts?.headers } });
  return res;
}

export function Admin() {
  const [tab, setTab] = useState<string>("types");

  const TABS = [
    { key: "types",     label: "Vehicle Types" },
    { key: "levels",    label: "Vehicle Suspicion" },
    { key: "actorlevels", label: "Actor Suspicion" },
    { key: "identifiers", label: "Actor Identifiers" },
    { key: "dispatch",  label: "Dispatch Types" },
    { key: "integrations", label: "Integrations" },
    { key: "import",    label: "Import" },
    { key: "operators", label: "Operators" },
    { key: "reporters", label: "Reporters" },
    { key: "channels",  label: "Notifications" },
    { key: "feedback",  label: "Feedback" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Administration</h1>
      <div className="flex gap-1 mb-6 bg-trace-bg rounded-lg p-1 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-2 rounded-md text-sm transition-colors whitespace-nowrap ${
              tab === t.key ? "bg-trace-surface text-trace-accent font-medium shadow-sm" : "text-gray-500 hover:text-gray-300"
            }`}
          >{t.label}</button>
        ))}
      </div>
      {tab === "types"       && <VehicleTypesAdmin />}
      {tab === "levels"      && <SuspicionLevelsAdmin />}
      {tab === "actorlevels" && <ActorSuspicionLevelsAdmin />}
      {tab === "identifiers" && <ActorIdentifierTypesAdmin />}
      {tab === "dispatch"    && <DispatchTypesAdmin />}
      {tab === "integrations" && <IntegrationsAdmin />}
      {tab === "import"      && <ImportAdmin />}
      {tab === "operators"   && <OperatorsAdmin />}
      {tab === "reporters"   && <ReportersAdmin />}
      {tab === "channels"    && <ChannelsAdmin />}
      {tab === "feedback"    && <FeedbackAdmin />}
    </div>
  );
}

// ============ Vehicle Types — full CRUD ============
function VehicleTypesAdmin() {
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ label: "", description: "", color: "#4fc3f7" });
  const toast = useToast();
  const confirm = useConfirm();

  const load = () => {
    setLoading(true);
    api.getVehicleTypes()
      .then((t) => setTypes(Array.isArray(t) ? t : []))
      .catch(() => toast("Failed to load", "error"))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const startEdit = (t: any) => {
    setEditing(t.id);
    setForm({ label: t.label, description: t.description || "", color: t.color || "#4fc3f7" });
  };

  const saveEdit = async (id: string) => {
    const res = await apiFetch(`/vehicle-types/${id}`, { method: "PUT", body: JSON.stringify(form) });
    if (res.ok) {
      const updated = await res.json();
      setTypes((t) => t.map((x) => x.id === id ? updated : x));
      setEditing(null);
      toast("Vehicle type updated", "success");
    } else { toast("Failed to update", "error"); }
  };

  const handleDelete = async (t: any) => {
    const ok = await confirm({
      title: `Delete "${t.label}"?`,
      message: "This will permanently remove the vehicle type. Vehicles currently assigned this type will need to be reassigned.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;

    const res = await apiFetch(`/vehicle-types/${t.id}`, { method: "DELETE" });
    if (res.ok) {
      setTypes((ts) => ts.filter((x) => x.id !== t.id));
      toast(`"${t.label}" deleted`, "success");
    } else {
      const err = await res.json();
      toast(err.reason || "Cannot delete - has dependencies", "error");
    }
  };

  const handleAdd = async () => {
    if (!form.label.trim()) { toast("Label is required", "warning"); return; }
    const res = await apiFetch("/vehicle-types", { method: "POST", body: JSON.stringify(form) });
    if (res.ok) {
      const vt = await res.json();
      setTypes((t) => [...t, vt]);
      setForm({ label: "", description: "", color: "#4fc3f7" });
      setAdding(false);
      toast(`"${form.label}" created`, "success");
    } else { toast("Failed to create", "error"); }
  };

  if (loading) return <SkeletonList count={4} />;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">Vehicle Types</h2>
          <HelpTip text="Operational roles (Runner, Scout, etc). Chapter-scoped. A vehicle can hold multiple types simultaneously." />
        </div>
        <button onClick={() => { setAdding(true); setForm({ label: "", description: "", color: "#4fc3f7" }); }}
          className="text-xs bg-trace-accent text-trace-bg px-3 py-1.5 rounded-lg font-semibold">+ Add</button>
      </div>

      <div className="space-y-2">
        {types.map((t) => (
          <div key={t.id} className="p-3 bg-trace-surface rounded-lg border border-trace-border">
            {editing === t.id ? (
              <div className="space-y-3">
                <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} className={inputCls} placeholder="Label" />
                <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={inputCls} placeholder="Description" />
                <ColorPicker value={form.color} onChange={(c) => setForm((f) => ({ ...f, color: c }))} />
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(t.id)} className="bg-trace-accent text-trace-bg px-3 py-1.5 rounded-lg text-xs font-semibold">Save</button>
                  <button onClick={() => setEditing(null)} className="text-gray-400 text-xs">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full flex-shrink-0 border border-white/20" style={{ background: t.color }} />
                <div className="flex-1">
                  <span className="font-medium text-sm">{t.label}</span>
                  {t.description && <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>}
                </div>
                <button onClick={() => startEdit(t)} className="text-xs text-gray-500 hover:text-trace-accent transition">Edit</button>
                <button onClick={() => handleDelete(t)} className="text-xs text-gray-500 hover:text-trace-danger transition">Delete</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {adding && (
        <div className="mt-4 p-4 bg-trace-surface rounded-lg border border-trace-accent/30">
          <h3 className="text-sm font-semibold mb-3">New Vehicle Type</h3>
          <div className="space-y-3">
            <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} className={inputCls} placeholder="Label (e.g. Runner)" />
            <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={inputCls} placeholder="Description" />
            <ColorPicker value={form.color} onChange={(c) => setForm((f) => ({ ...f, color: c }))} />
            <div className="flex gap-2">
              <button onClick={handleAdd} className="bg-trace-accent text-trace-bg px-3 py-1.5 rounded-lg text-sm font-semibold">Create</button>
              <button onClick={() => setAdding(false)} className="text-gray-400 text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Suspicion Levels — full CRUD + predicate rules ============
function SuspicionLevelsAdmin() {
  const [levels, setLevels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [expandedPredicates, setExpandedPredicates] = useState<string | null>(null);
  const [form, setForm] = useState({ label: "", rank: "", description: "", color: "#3498db" });
  const toast = useToast();
  const confirm = useConfirm();

  const load = () => {
    setLoading(true);
    api.getSuspicionLevels()
      .then((l) => setLevels(Array.isArray(l) ? l.sort((a: any, b: any) => a.rank - b.rank) : []))
      .catch(() => toast("Failed to load", "error"))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const startEdit = (l: any) => {
    setEditing(l.id);
    setForm({ label: l.label, rank: String(l.rank), description: l.description || "", color: l.color || "#3498db" });
  };

  const saveEdit = async (id: string) => {
    const res = await apiFetch(`/suspicion-levels/${id}`, {
      method: "PUT",
      body: JSON.stringify({ ...form, rank: parseInt(form.rank) }),
    });
    if (res.ok) {
      const updated = await res.json();
      setLevels((l) => l.map((x) => x.id === id ? updated : x).sort((a, b) => a.rank - b.rank));
      setEditing(null);
      toast("Level updated", "success");
    } else { toast("Failed to update", "error"); }
  };

  const handleDelete = async (l: any) => {
    const ok = await confirm({
      title: `Delete "${l.label}"?`,
      message: "Vehicles at this suspicion level will need to be reassigned. All promotion predicates targeting this level will also be deleted.",
      confirmLabel: "Delete Level",
      danger: true,
    });
    if (!ok) return;

    const res = await apiFetch(`/suspicion-levels/${l.id}`, { method: "DELETE" });
    if (res.ok) {
      setLevels((ls) => ls.filter((x) => x.id !== l.id));
      toast(`"${l.label}" deleted`, "success");
    } else {
      const err = await res.json();
      toast(err.reason || "Cannot delete - has dependencies", "error");
    }
  };

  const handleAdd = async () => {
    if (!form.label.trim() || !form.rank) { toast("Label and rank required", "warning"); return; }
    const res = await apiFetch("/suspicion-levels", {
      method: "POST",
      body: JSON.stringify({ ...form, rank: parseInt(form.rank) }),
    });
    if (res.ok) {
      const level = await res.json();
      setLevels((l) => [...l, level].sort((a, b) => a.rank - b.rank));
      setForm({ label: "", rank: "", description: "", color: "#3498db" });
      setAdding(false);
      toast(`"${form.label}" created`, "success");
    } else { toast("Failed to create", "error"); }
  };

  if (loading) return <SkeletonList count={5} />;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">Suspicion Ladder</h2>
          <HelpTip text="Graduated evidence levels. Each level can have promotion predicates - rules that must be met before a vehicle can be promoted to that level." />
        </div>
        <button onClick={() => { setAdding(true); setForm({ label: "", rank: "", description: "", color: "#3498db" }); }}
          className="text-xs bg-trace-accent text-trace-bg px-3 py-1.5 rounded-lg font-semibold">+ Add Level</button>
      </div>

      <div className="space-y-2">
        {levels.map((l) => (
          <div key={l.id} className="bg-trace-surface rounded-lg border border-trace-border overflow-hidden">
            <div className="p-3">
              {editing === l.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} className={inputCls} placeholder="Label" />
                    <input value={form.rank} onChange={(e) => setForm((f) => ({ ...f, rank: e.target.value }))} className={inputCls} placeholder="Rank" type="number" />
                  </div>
                  <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={inputCls} placeholder="Description" />
                  <ColorPicker value={form.color} onChange={(c) => setForm((f) => ({ ...f, color: c }))} />
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(l.id)} className="bg-trace-accent text-trace-bg px-3 py-1.5 rounded-lg text-xs font-semibold">Save</button>
                    <button onClick={() => setEditing(null)} className="text-gray-400 text-xs">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full flex-shrink-0 border border-white/20" style={{ background: l.color }} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{l.label}</span>
                      <span className="text-[10px] text-gray-600 bg-trace-bg px-1.5 py-0.5 rounded font-mono">rank {l.rank}</span>
                    </div>
                    {l.description && <p className="text-xs text-gray-500 mt-0.5">{l.description}</p>}
                  </div>
                  <button onClick={() => setExpandedPredicates(expandedPredicates === l.id ? null : l.id)}
                    className="text-xs text-gray-500 hover:text-trace-accent transition">
                    {expandedPredicates === l.id ? "Hide Rules" : "Rules"}
                  </button>
                  <button onClick={() => startEdit(l)} className="text-xs text-gray-500 hover:text-trace-accent transition">Edit</button>
                  <button onClick={() => handleDelete(l)} className="text-xs text-gray-500 hover:text-trace-danger transition">Delete</button>
                </div>
              )}
            </div>

            {/* Predicate rules panel */}
            {expandedPredicates === l.id && (
              <PredicatePanel levelId={l.id} levelLabel={l.label} />
            )}
          </div>
        ))}
      </div>

      {adding && (
        <div className="mt-4 p-4 bg-trace-surface rounded-lg border border-trace-accent/30">
          <h3 className="text-sm font-semibold mb-3">New Suspicion Level</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} className={inputCls} placeholder="Label" />
              <input value={form.rank} onChange={(e) => setForm((f) => ({ ...f, rank: e.target.value }))} className={inputCls} placeholder="Rank (0=retired, higher=more suspicious)" type="number" />
            </div>
            <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={inputCls} placeholder="Description" />
            <ColorPicker value={form.color} onChange={(c) => setForm((f) => ({ ...f, color: c }))} />
            <div className="flex gap-2">
              <button onClick={handleAdd} className="bg-trace-accent text-trace-bg px-3 py-1.5 rounded-lg text-sm font-semibold">Create</button>
              <button onClick={() => setAdding(false)} className="text-gray-400 text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Predicate Configuration Panel ============
function PredicatePanel({ levelId, levelLabel }: { levelId: string; levelLabel: string }) {
  const [predicates, setPredicates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newPred, setNewPred] = useState({ label: "", predicateType: "sighting_count", conjunction: "OR", config: { field: "sighting_count", operator: ">=", value: 3, window_days: 30 } });
  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    apiFetch(`/suspicion-levels/${levelId}/predicates`)
      .then((r) => r.json())
      .then((p) => setPredicates(Array.isArray(p) ? p : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [levelId]);

  const handleAdd = async () => {
    if (!newPred.label.trim()) { toast("Label required", "warning"); return; }
    const res = await apiFetch(`/suspicion-levels/${levelId}/predicates`, {
      method: "POST",
      body: JSON.stringify(newPred),
    });
    if (res.ok) {
      const pred = await res.json();
      setPredicates((p) => [...p, pred]);
      setAdding(false);
      setNewPred({ label: "", predicateType: "sighting_count", conjunction: "OR", config: { field: "sighting_count", operator: ">=", value: 3, window_days: 30 } });
      toast("Promotion rule added", "success");
    } else { toast("Failed to add rule", "error"); }
  };

  const handleDelete = async (pred: any) => {
    const ok = await confirm({ title: "Delete promotion rule?", message: `Remove "${pred.label}" from the ${levelLabel} promotion criteria?`, confirmLabel: "Delete", danger: true });
    if (!ok) return;
    const res = await apiFetch(`/suspicion-predicates/${pred.id}`, { method: "DELETE" });
    if (res.ok) {
      setPredicates((p) => p.filter((x) => x.id !== pred.id));
      toast("Rule deleted", "success");
    }
  };

  return (
    <div className="border-t border-trace-border bg-trace-bg/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Promotion Rules for {levelLabel}</span>
          <HelpTip text="Rules that must be met before a vehicle can be promoted to this level. Configure as AND (all must match) or OR (any one suffices)." />
        </div>
        <button onClick={() => setAdding(true)} className="text-xs text-trace-accent hover:underline">+ Add Rule</button>
      </div>

      {loading ? (
        <div className="text-xs text-gray-600">Loading rules...</div>
      ) : predicates.length === 0 ? (
        <div className="text-xs text-gray-600 py-2">
          No promotion rules configured. Vehicles can be promoted to this level by manual operator override only.
        </div>
      ) : (
        <div className="space-y-2">
          {predicates.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2 p-2 bg-trace-surface rounded border border-trace-border text-xs">
              {i > 0 && <span className="text-trace-accent font-semibold">{p.conjunction}</span>}
              <div className="flex-1">
                <span className="font-medium">{p.label}</span>
                <span className="text-gray-500 ml-2">
                  {formatPredicate(p)}
                </span>
              </div>
              <button onClick={() => handleDelete(p)} className="text-gray-500 hover:text-trace-danger">✕</button>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="mt-3 p-3 bg-trace-surface rounded border border-trace-accent/30 space-y-2">
          <input value={newPred.label} onChange={(e) => setNewPred((p) => ({ ...p, label: e.target.value }))}
            className={`${inputCls} text-xs`} placeholder="Rule label (e.g. '3+ sightings in 30 days')" />

          <div className="grid grid-cols-2 gap-2">
            <select value={newPred.predicateType}
              onChange={(e) => setNewPred((p) => ({ ...p, predicateType: e.target.value, config: { ...p.config, field: e.target.value } }))}
              className={`${inputCls} text-xs`}>
              {PREDICATE_TYPES.map((pt) => (
                <option key={pt.value} value={pt.value}>{pt.label}</option>
              ))}
            </select>
            <select value={newPred.conjunction}
              onChange={(e) => setNewPred((p) => ({ ...p, conjunction: e.target.value }))}
              className={`${inputCls} text-xs`}>
              <option value="OR">OR (any rule)</option>
              <option value="AND">AND (all rules)</option>
            </select>
          </div>

          {/* Config fields based on predicate type */}
          {PREDICATE_TYPES.find((pt) => pt.value === newPred.predicateType)?.fields.includes("operator") && (
            <div className="grid grid-cols-3 gap-2">
              <select value={newPred.config.operator || ">="}
                onChange={(e) => setNewPred((p) => ({ ...p, config: { ...p.config, operator: e.target.value } }))}
                className={`${inputCls} text-xs`}>
                <option value=">=">≥</option>
                <option value=">">{">"}</option>
                <option value="==">= exactly</option>
              </select>
              <input type="number" value={newPred.config.value || 3}
                onChange={(e) => setNewPred((p) => ({ ...p, config: { ...p.config, value: parseInt(e.target.value) } }))}
                className={`${inputCls} text-xs`} placeholder="Value" />
              {PREDICATE_TYPES.find((pt) => pt.value === newPred.predicateType)?.fields.includes("window_days") && (
                <input type="number" value={newPred.config.window_days || 30}
                  onChange={(e) => setNewPred((p) => ({ ...p, config: { ...p.config, window_days: parseInt(e.target.value) } }))}
                  className={`${inputCls} text-xs`} placeholder="Days window" />
              )}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={handleAdd} className="bg-trace-accent text-trace-bg px-3 py-1 rounded text-xs font-semibold">Add Rule</button>
            <button onClick={() => setAdding(false)} className="text-gray-400 text-xs">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatPredicate(p: any): string {
  const config = p.config || {};
  switch (p.predicateType) {
    case "sighting_count": return `${config.operator || ">="} ${config.value || "?"} sightings${config.window_days ? ` in ${config.window_days} days` : ""}`;
    case "has_driver": return "identified driver linked";
    case "has_type": return "vehicle type assigned";
    case "plate_swap_count": return `${config.operator || ">="} ${config.value || "?"} plate swaps`;
    default: return p.predicateType;
  }
}

// ============ Actor Suspicion Levels — same pattern as vehicle ============
function ActorSuspicionLevelsAdmin() {
  const [levels, setLevels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [expandedPredicates, setExpandedPredicates] = useState<string | null>(null);
  const [form, setForm] = useState({ label: "", rank: "", description: "", color: "#3498db" });
  const toast = useToast();
  const confirm = useConfirm();

  const load = () => {
    setLoading(true);
    apiFetch("/actor-suspicion-levels").then((r) => r.json())
      .then((l) => setLevels(Array.isArray(l) ? l.sort((a: any, b: any) => a.rank - b.rank) : []))
      .catch(() => toast("Failed to load", "error"))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const startEdit = (l: any) => { setEditing(l.id); setForm({ label: l.label, rank: String(l.rank), description: l.description || "", color: l.color || "#3498db" }); };

  const saveEdit = async (id: string) => {
    const res = await apiFetch(`/actor-suspicion-levels/${id}`, { method: "PUT", body: JSON.stringify({ ...form, rank: parseInt(form.rank) }) });
    if (res.ok) { const u = await res.json(); setLevels((l) => l.map((x) => x.id === id ? u : x).sort((a, b) => a.rank - b.rank)); setEditing(null); toast("Updated", "success"); }
    else toast("Failed", "error");
  };

  const handleDelete = async (l: any) => {
    const ok = await confirm({ title: `Delete "${l.label}"?`, message: "Actors at this level will need reassignment.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    const res = await apiFetch(`/actor-suspicion-levels/${l.id}`, { method: "DELETE" });
    if (res.ok) { setLevels((ls) => ls.filter((x) => x.id !== l.id)); toast("Deleted", "success"); }
    else { const err = await res.json(); toast(err.reason || "Has dependencies", "error"); }
  };

  const handleAdd = async () => {
    if (!form.label.trim() || !form.rank) { toast("Label and rank required", "warning"); return; }
    const res = await apiFetch("/actor-suspicion-levels", { method: "POST", body: JSON.stringify({ ...form, rank: parseInt(form.rank) }) });
    if (res.ok) { const l = await res.json(); setLevels((ls) => [...ls, l].sort((a, b) => a.rank - b.rank)); setForm({ label: "", rank: "", description: "", color: "#3498db" }); setAdding(false); toast("Created", "success"); }
    else toast("Failed", "error");
  };

  if (loading) return <SkeletonList count={5} />;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">Actor Suspicion Ladder</h2>
          <HelpTip text="Behavioral evidence ladder for actors. Separate from vehicle levels. Configurable predicates: vehicle links, aggression reports, territorial behavior." />
        </div>
        <button onClick={() => { setAdding(true); setForm({ label: "", rank: "", description: "", color: "#3498db" }); }}
          className="text-xs bg-trace-accent text-trace-bg px-3 py-1.5 rounded-lg font-semibold">+ Add Level</button>
      </div>
      <div className="space-y-2">
        {levels.map((l) => (
          <div key={l.id} className="bg-trace-surface rounded-lg border border-trace-border overflow-hidden">
            <div className="p-3">
              {editing === l.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} className={inputCls} placeholder="Label" />
                    <input value={form.rank} onChange={(e) => setForm((f) => ({ ...f, rank: e.target.value }))} className={inputCls} placeholder="Rank" type="number" />
                  </div>
                  <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={inputCls} placeholder="Description" />
                  <ColorPicker value={form.color} onChange={(c) => setForm((f) => ({ ...f, color: c }))} />
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(l.id)} className="bg-trace-accent text-trace-bg px-3 py-1.5 rounded-lg text-xs font-semibold">Save</button>
                    <button onClick={() => setEditing(null)} className="text-gray-400 text-xs">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full flex-shrink-0 border border-white/20" style={{ background: l.color }} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{l.label}</span>
                      <span className="text-[10px] text-gray-600 bg-trace-bg px-1.5 py-0.5 rounded font-mono">rank {l.rank}</span>
                    </div>
                    {l.description && <p className="text-xs text-gray-500 mt-0.5">{l.description}</p>}
                  </div>
                  <button onClick={() => setExpandedPredicates(expandedPredicates === l.id ? null : l.id)} className="text-xs text-gray-500 hover:text-trace-accent transition">Rules</button>
                  <button onClick={() => startEdit(l)} className="text-xs text-gray-500 hover:text-trace-accent transition">Edit</button>
                  <button onClick={() => handleDelete(l)} className="text-xs text-gray-500 hover:text-trace-danger transition">Delete</button>
                </div>
              )}
            </div>
            {expandedPredicates === l.id && <ActorPredicatePanel levelId={l.id} levelLabel={l.label} />}
          </div>
        ))}
      </div>
      {adding && (
        <div className="mt-4 p-4 bg-trace-surface rounded-lg border border-trace-accent/30 space-y-3">
          <h3 className="text-sm font-semibold">New Actor Level</h3>
          <div className="grid grid-cols-2 gap-3">
            <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} className={inputCls} placeholder="Label" />
            <input value={form.rank} onChange={(e) => setForm((f) => ({ ...f, rank: e.target.value }))} className={inputCls} placeholder="Rank" type="number" />
          </div>
          <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={inputCls} placeholder="Description" />
          <ColorPicker value={form.color} onChange={(c) => setForm((f) => ({ ...f, color: c }))} />
          <div className="flex gap-2"><button onClick={handleAdd} className="bg-trace-accent text-trace-bg px-3 py-1.5 rounded-lg text-sm font-semibold">Create</button><button onClick={() => setAdding(false)} className="text-gray-400 text-sm">Cancel</button></div>
        </div>
      )}
    </div>
  );
}

const ACTOR_PREDICATE_TYPES = [
  { value: "vehicle_link_count", label: "Vehicle link count", fields: ["operator", "value"] },
  { value: "aggression_incident", label: "Aggression incidents", fields: ["operator", "value", "window_days"] },
  { value: "following_report", label: "Following reporter report", fields: [] },
  { value: "identifier_count", label: "Identifiers recorded", fields: ["operator", "value"] },
  { value: "territory_confirmed", label: "Territory confirmed", fields: [] },
];

function ActorPredicatePanel({ levelId, levelLabel }: { levelId: string; levelLabel: string }) {
  const [predicates, setPredicates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newPred, setNewPred] = useState({ label: "", predicateType: "vehicle_link_count", conjunction: "OR", config: { operator: ">=", value: 2 } });
  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    apiFetch(`/actor-suspicion-levels/${levelId}/predicates`).then((r) => r.json()).then((p) => setPredicates(Array.isArray(p) ? p : [])).catch(() => {}).finally(() => setLoading(false));
  }, [levelId]);

  const handleAdd = async () => {
    if (!newPred.label.trim()) { toast("Label required", "warning"); return; }
    const res = await apiFetch(`/actor-suspicion-levels/${levelId}/predicates`, { method: "POST", body: JSON.stringify(newPred) });
    if (res.ok) { const p = await res.json(); setPredicates((ps) => [...ps, p]); setAdding(false); toast("Rule added", "success"); }
    else toast("Failed", "error");
  };

  const handleDelete = async (pred: any) => {
    const ok = await confirm({ title: "Delete rule?", message: `Remove "${pred.label}"?`, confirmLabel: "Delete", danger: true });
    if (!ok) return;
    await apiFetch(`/actor-suspicion-predicates/${pred.id}`, { method: "DELETE" });
    setPredicates((p) => p.filter((x) => x.id !== pred.id));
    toast("Deleted", "success");
  };

  return (
    <div className="border-t border-trace-border bg-trace-bg/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Promotion Rules - {levelLabel}</span>
        <button onClick={() => setAdding(true)} className="text-xs text-trace-accent">+ Add Rule</button>
      </div>
      {loading ? <div className="text-xs text-gray-600">Loading...</div> : predicates.length === 0 ? (
        <div className="text-xs text-gray-600 py-2">No rules. Manual operator override only.</div>
      ) : (
        <div className="space-y-2">
          {predicates.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2 p-2 bg-trace-surface rounded border border-trace-border text-xs">
              {i > 0 && <span className="text-trace-accent font-semibold">{p.conjunction}</span>}
              <span className="font-medium flex-1">{p.label} <span className="text-gray-500">{formatActorPredicate(p)}</span></span>
              <button onClick={() => handleDelete(p)} className="text-gray-500 hover:text-trace-danger">✕</button>
            </div>
          ))}
        </div>
      )}
      {adding && (
        <div className="mt-3 p-3 bg-trace-surface rounded border border-trace-accent/30 space-y-2">
          <input value={newPred.label} onChange={(e) => setNewPred((p) => ({ ...p, label: e.target.value }))} className={`${inputCls} text-xs`} placeholder="Rule label" />
          <div className="grid grid-cols-2 gap-2">
            <select value={newPred.predicateType} onChange={(e) => setNewPred((p) => ({ ...p, predicateType: e.target.value }))} className={`${inputCls} text-xs`}>
              {ACTOR_PREDICATE_TYPES.map((pt) => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
            </select>
            <select value={newPred.conjunction} onChange={(e) => setNewPred((p) => ({ ...p, conjunction: e.target.value }))} className={`${inputCls} text-xs`}>
              <option value="OR">OR</option><option value="AND">AND</option>
            </select>
          </div>
          {ACTOR_PREDICATE_TYPES.find((pt) => pt.value === newPred.predicateType)?.fields.includes("operator") && (
            <div className="grid grid-cols-3 gap-2">
              <select value={newPred.config.operator || ">="} onChange={(e) => setNewPred((p) => ({ ...p, config: { ...p.config, operator: e.target.value } }))} className={`${inputCls} text-xs`}>
                <option value=">=">≥</option><option value=">">{">"}</option><option value="==">= exactly</option>
              </select>
              <input type="number" value={(newPred.config as any).value || 2} onChange={(e) => setNewPred((p) => ({ ...p, config: { ...p.config, value: parseInt(e.target.value) } }))} className={`${inputCls} text-xs`} />
              {ACTOR_PREDICATE_TYPES.find((pt) => pt.value === newPred.predicateType)?.fields.includes("window_days") && (
                <input type="number" value={(newPred.config as any).window_days || 30} onChange={(e) => setNewPred((p) => ({ ...p, config: { ...p.config, window_days: parseInt(e.target.value) } }))} className={`${inputCls} text-xs`} placeholder="Days" />
              )}
            </div>
          )}
          <div className="flex gap-2"><button onClick={handleAdd} className="bg-trace-accent text-trace-bg px-3 py-1 rounded text-xs font-semibold">Add</button><button onClick={() => setAdding(false)} className="text-gray-400 text-xs">Cancel</button></div>
        </div>
      )}
    </div>
  );
}

function formatActorPredicate(p: any): string {
  const c = p.config || {};
  switch (p.predicateType) {
    case "vehicle_link_count": return `${c.operator || ">="} ${c.value || "?"} linked vehicles`;
    case "aggression_incident": return `${c.operator || ">="} ${c.value || "?"} incidents${c.window_days ? ` in ${c.window_days}d` : ""}`;
    case "following_report": return "following reporter confirmed";
    case "identifier_count": return `${c.operator || ">="} ${c.value || "?"} identifiers recorded`;
    case "territory_confirmed": return "territory mapping confirmed";
    default: return p.predicateType;
  }
}

// ============ Actor Identifier Types — chapter-defined taxonomy ============
function ActorIdentifierTypesAdmin() {
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ label: "", description: "", icon: "", color: "#9b59b6", fieldType: "text", options: "[]" });
  const toast = useToast();
  const confirm = useConfirm();

  const load = () => {
    setLoading(true);
    apiFetch("/actor-identifier-types").then((r) => r.json())
      .then((t) => setTypes(Array.isArray(t) ? t : []))
      .catch(() => toast("Failed to load", "error"))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const startEdit = (t: any) => { setEditing(t.id); setForm({ label: t.label, description: t.description || "", icon: t.icon || "", color: t.color || "#9b59b6", fieldType: t.fieldType || "text", options: JSON.stringify(t.options || []) }); };

  const saveEdit = async (id: string) => {
    let opts: any[] = [];
    try { opts = JSON.parse(form.options); } catch { opts = []; }
    const res = await apiFetch(`/actor-identifier-types/${id}`, { method: "PUT", body: JSON.stringify({ ...form, options: opts }) });
    if (res.ok) { const u = await res.json(); setTypes((t) => t.map((x) => x.id === id ? u : x)); setEditing(null); toast("Updated", "success"); }
    else toast("Failed", "error");
  };

  const handleDelete = async (t: any) => {
    const ok = await confirm({ title: `Delete "${t.label}"?`, message: "Identifiers using this type will need to be removed first.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    const res = await apiFetch(`/actor-identifier-types/${t.id}`, { method: "DELETE" });
    if (res.ok) { setTypes((ts) => ts.filter((x) => x.id !== t.id)); toast("Deleted", "success"); }
    else { const err = await res.json(); toast(err.reason || "Has dependencies", "error"); }
  };

  const handleAdd = async () => {
    if (!form.label.trim()) { toast("Label required", "warning"); return; }
    let opts: any[] = [];
    try { opts = JSON.parse(form.options); } catch { opts = []; }
    const res = await apiFetch("/actor-identifier-types", { method: "POST", body: JSON.stringify({ ...form, options: opts }) });
    if (res.ok) { const t = await res.json(); setTypes((ts) => [...ts, t]); setForm({ label: "", description: "", icon: "", color: "#9b59b6", fieldType: "text", options: "[]" }); setAdding(false); toast("Created", "success"); }
    else toast("Failed", "error");
  };

  if (loading) return <SkeletonList count={6} />;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">Actor Identifier Types</h2>
          <HelpTip text="Define what identifying characteristics your chapter tracks. Each chapter customizes these for their operation - tattoos, clothing, scars, speech patterns, etc." />
        </div>
        <button onClick={() => { setAdding(true); setForm({ label: "", description: "", icon: "", color: "#9b59b6", fieldType: "text", options: "[]" }); }}
          className="text-xs bg-trace-accent text-trace-bg px-3 py-1.5 rounded-lg font-semibold">+ Add Type</button>
      </div>

      <div className="space-y-2">
        {types.map((t) => (
          <div key={t.id} className="p-3 bg-trace-surface rounded-lg border border-trace-border">
            {editing === t.id ? (
              <IdentifierTypeForm form={form} setForm={setForm} onSave={() => saveEdit(t.id)} onCancel={() => setEditing(null)} />
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-lg w-6 text-center">{t.icon || "🏷"}</span>
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: t.color }} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{t.label}</span>
                    <span className="text-[10px] text-gray-600 bg-trace-bg px-1.5 py-0.5 rounded">{t.fieldType}</span>
                  </div>
                  {t.description && <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>}
                  {t.fieldType === "select" && t.options?.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {(t.options as string[]).map((o: string) => (
                        <span key={o} className="text-[10px] px-1.5 py-0.5 bg-trace-bg rounded text-gray-400">{o}</span>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => startEdit(t)} className="text-xs text-gray-500 hover:text-trace-accent transition">Edit</button>
                <button onClick={() => handleDelete(t)} className="text-xs text-gray-500 hover:text-trace-danger transition">Delete</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {adding && (
        <div className="mt-4 p-4 bg-trace-surface rounded-lg border border-trace-accent/30">
          <h3 className="text-sm font-semibold mb-3">New Identifier Type</h3>
          <IdentifierTypeForm form={form} setForm={setForm} onSave={handleAdd} onCancel={() => setAdding(false)} />
        </div>
      )}
    </div>
  );
}

function IdentifierTypeForm({ form, setForm, onSave, onCancel }: { form: any; setForm: any; onSave: () => void; onCancel: () => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input value={form.label} onChange={(e) => setForm((f: any) => ({ ...f, label: e.target.value }))} className={inputCls} placeholder="Label (e.g. Tattoo)" />
        <input value={form.icon} onChange={(e) => setForm((f: any) => ({ ...f, icon: e.target.value }))} className={inputCls} placeholder="Icon emoji (e.g. 🖋)" />
      </div>
      <input value={form.description} onChange={(e) => setForm((f: any) => ({ ...f, description: e.target.value }))} className={inputCls} placeholder="Description" />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">Field Type</label>
          <select value={form.fieldType} onChange={(e) => setForm((f: any) => ({ ...f, fieldType: e.target.value }))} className={inputCls}>
            <option value="text">Free text</option>
            <option value="select">Single select (predefined options)</option>
            <option value="multiselect">Multi-select</option>
            <option value="location">Location (body part)</option>
          </select>
        </div>
        <ColorPicker value={form.color} onChange={(c) => setForm((f: any) => ({ ...f, color: c }))} />
      </div>
      {(form.fieldType === "select" || form.fieldType === "multiselect") && (
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">Options (JSON array)</label>
          <input value={form.options} onChange={(e) => setForm((f: any) => ({ ...f, options: e.target.value }))} className={inputCls} placeholder='["Option A", "Option B", "Option C"]' />
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={onSave} className="bg-trace-accent text-trace-bg px-3 py-1.5 rounded-lg text-sm font-semibold">Save</button>
        <button onClick={onCancel} className="text-gray-400 text-sm">Cancel</button>
      </div>
    </div>
  );
}

// ============ Operators ============
function OperatorsAdmin() {
  const [operators, setOperators] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newCallsign, setNewCallsign] = useState("");
  const [newCode, setNewCode] = useState("");
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    apiFetch("/operators").then((r) => r.json())
      .then((d) => setOperators(Array.isArray(d) ? d : []))
      .catch(() => toast("Failed to load operators", "error"))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!newCallsign.trim()) { toast("Callsign required", "warning"); return; }
    if (!newCode || newCode.length < 6) { toast("Access code must be 6+ characters", "warning"); return; }
    setSaving(true);
    const res = await apiFetch("/operators/create", {
      method: "POST", body: JSON.stringify({ callsign: newCallsign, accessCode: newCode }),
    });
    if (res.ok) {
      const data = await res.json();
      setOperators((prev) => [...prev, { id: data.reporterId, callsign: data.callsign, status: "active", hasAccessCode: true, createdAt: new Date().toISOString() }]);
      setNewCallsign(""); setNewCode(""); setAdding(false);
      toast(`Operator "${data.callsign}" created`, "success");
    } else {
      const err = await res.json().catch(() => ({}));
      toast(err.error || "Failed to create operator", "error");
    }
    setSaving(false);
  };

  if (loading) return <SkeletonList count={3} />;

  return (
    <div className="max-w-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">Operators</h2>
          <HelpTip text="Manage operator accounts. Each operator needs a callsign and access code to log in." />
        </div>
        <button onClick={() => setAdding(true)} className="text-xs bg-trace-accent text-trace-bg px-3 py-1.5 rounded-lg font-semibold">+ Add Operator</button>
      </div>

      <div className="space-y-2">
        {operators.map((op) => (
          <div key={op.id} className="p-3 bg-trace-surface rounded-lg border border-trace-border flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
              {op.callsign?.slice(0, 2) || "OP"}
            </div>
            <div className="flex-1">
              <div className="font-mono font-medium text-sm tracking-wider">{op.callsign}</div>
              <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                {op.hasAccessCode ? "Access code set" : "No access code"} · {op.status}
              </div>
            </div>
          </div>
        ))}
        {operators.length === 0 && (
          <EmptyState icon="👤" title="No operators" description="Create the first operator account." />
        )}
      </div>

      {adding && (
        <div className="mt-4 p-5 bg-trace-surface rounded-lg border border-trace-accent/30 space-y-3">
          <h3 className="text-sm font-semibold">New Operator</h3>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">Callsign</label>
            <input value={newCallsign} onChange={(e) => setNewCallsign(e.target.value)}
              className={inputCls} placeholder="OPERATOR-2" style={{ textTransform: "uppercase", letterSpacing: "1px" }} />
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">Access Code</label>
            <input type="password" value={newCode} onChange={(e) => setNewCode(e.target.value)}
              className={inputCls} placeholder="6+ characters" />
            <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>Give this to the operator in person or via encrypted channel.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={saving}
              className="bg-trace-accent text-trace-bg px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
              {saving ? "Creating..." : "Create Operator"}
            </button>
            <button onClick={() => setAdding(false)} className="text-gray-400 text-sm">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Reporters ============
function ReportersAdmin() {
  const [callsign, setCallsign] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastInvite, setLastInvite] = useState<{ callsign: string; code: string } | null>(null);
  const toast = useToast();

  const handleGenerate = async () => {
    if (!callsign) { toast("Callsign required", "warning"); return; }
    setSaving(true);
    try {
      const res = await apiFetch("/reporters/generate-invite", {
        method: "POST",
        body: JSON.stringify({ callsign }),
      });
      if (res.ok) {
        const data = await res.json();
        setLastInvite({ callsign: data.callsign, code: data.inviteCode });
        setCallsign("");
        toast(`Invite code generated for "${data.callsign}"`, "success");
      } else {
        toast("Failed to generate invite", "error");
      }
    } catch { toast("Failed", "error"); }
    setSaving(false);
  };

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-semibold">Invite Reporter</h2>
        <HelpTip text="Generate an invite code to give to a reporter in person. No email needed. Code expires in 7 days." />
      </div>

      <div className="bg-trace-surface rounded-lg p-5 border border-trace-border space-y-4">
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">Callsign *</label>
          <input value={callsign} onChange={(e) => setCallsign(e.target.value)}
            className={inputCls} placeholder="Operational pseudonym for this reporter" />
        </div>
        <button onClick={handleGenerate} disabled={saving}
          className="bg-trace-accent text-trace-bg px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition disabled:opacity-50">
          {saving ? "Generating..." : "Generate Invite Code"}
        </button>
      </div>

      {lastInvite && (
        <div className="mt-4 p-5 bg-trace-bg rounded-lg border-2 border-trace-accent">
          <div className="text-xs uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Send this to the reporter via Signal or in person</div>

          <div className="bg-trace-surface rounded-lg p-4 mb-3 border border-trace-border" style={{ fontFamily: "monospace" }}>
            <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Callsign</div>
            <div className="text-lg font-bold tracking-wider" style={{ color: "var(--text)" }}>{lastInvite.callsign}</div>
            <div className="text-xs mt-3 mb-1" style={{ color: "var(--text-muted)" }}>Join Code</div>
            <div className="text-2xl font-bold tracking-[5px] text-trace-accent">{lastInvite.code}</div>
          </div>

          <div className="text-xs space-y-1" style={{ color: "var(--text-muted)" }}>
            <p>The reporter enters the join code in the app. Their callsign identifies them in all operational data.</p>
            <p>You will not see their real identity. Only their callsign.</p>
            <p style={{ color: "var(--text-sec)" }}>Expires in 7 days. Single use. If compromised, generate a new one.</p>
          </div>

          <div className="flex gap-2 mt-3">
            <button onClick={() => {
              const msg = `Your TRACE callsign: ${lastInvite.callsign}\nJoin code: ${lastInvite.code}\n\nOpen TRACE, enter the join code. Your callsign is how we identify your reports.`;
              navigator.clipboard?.writeText(msg);
              toast("Copied message to clipboard", "success");
            }}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold bg-trace-accent text-trace-bg hover:opacity-90 transition">
              Copy Signal Message
            </button>
            <button onClick={() => { navigator.clipboard?.writeText(lastInvite.code); toast("Code copied", "success"); }}
              className="px-3 py-2 rounded-lg text-xs bg-trace-surface border border-trace-border hover:border-trace-accent transition">
              Code Only
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Notification Channels ============
function ChannelsAdmin() {
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    api.getChannels().then((c) => setChannels(Array.isArray(c) ? c : [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonList count={3} />;

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-semibold">Notification Channels</h2>
        <HelpTip text="Push notification topology. Admin assigns reporters to channels and sets trigger conditions." />
      </div>
      {channels.length === 0 ? (
        <EmptyState icon="🔔" title="No channels configured" description="Notification channels control who gets alerted when events occur." />
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
      <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Color</label>
      <div className="flex items-center gap-1.5 flex-wrap">
        {PRESET_COLORS.map((c) => (
          <button key={c} onClick={() => onChange(c)}
            className="w-6 h-6 rounded border-2 transition-all hover:scale-110"
            style={{
              background: c,
              borderColor: value === c ? "#fff" : "transparent",
              transform: value === c ? "scale(1.15)" : undefined,
            }}
          />
        ))}
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
          className="w-6 h-6 rounded cursor-pointer border-0 p-0" title="Custom color" />
      </div>
    </div>
  );
}

function LabeledInput({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} placeholder={placeholder} />
    </div>
  );
}

// ============ Feedback — bug reports from reporters ============
function FeedbackAdmin() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("open");
  const toast = useToast();

  const load = () => {
    setLoading(true);
    const url = filter ? `/feedback?status=${filter}` : "/feedback";
    apiFetch(url)
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .catch(() => toast("Failed to load feedback", "error"))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [filter]);

  const updateStatus = async (id: string, status: string) => {
    const res = await apiFetch(`/feedback/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    if (res.ok) { load(); toast(`Marked ${status}`, "success"); }
    else toast("Failed to update", "error");
  };

  const SEVERITY_COLORS: Record<string, string> = {
    critical: "#DC2626", high: "#EA580C", medium: "#D97706", low: "#94A3B8",
  };

  if (loading) return <SkeletonList count={3} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm" style={{ color: "var(--text-sec)" }}>
          Bug reports and suggestions from reporters. Review, acknowledge, and resolve.
        </p>
      </div>

      <div className="flex gap-1 mb-4">
        {["open", "acknowledged", "resolved", ""].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded text-xs transition ${filter === s ? "bg-trace-accent text-white font-medium" : "text-gray-500 hover:text-gray-300"}`}
          >{s || "All"}</button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12" style={{ color: "var(--text-muted)" }}>
          <p className="text-sm">No {filter || ""} feedback items.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="bg-trace-bg border border-trace-border rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="text-xs px-2 py-0.5 rounded mr-2" style={{
                    background: item.type === "bug" ? "rgba(220,38,38,0.15)" : "rgba(79,70,229,0.15)",
                    color: item.type === "bug" ? "#DC2626" : "#818CF8",
                  }}>{item.type}</span>
                  <span className="font-medium text-sm">{item.title}</span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded" style={{
                  background: `${SEVERITY_COLORS[item.severity] || "#94A3B8"}20`,
                  color: SEVERITY_COLORS[item.severity] || "#94A3B8",
                }}>{item.severity}</span>
              </div>

              <p className="text-sm mb-2" style={{ color: "var(--text-sec)" }}>{item.description}</p>

              <div className="flex items-center gap-4 text-xs" style={{ color: "var(--text-muted)" }}>
                {item.callsign && <span>From: {item.callsign}</span>}
                {item.page && <span>Page: {item.page}</span>}
                <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                <span className="px-1.5 py-0.5 rounded" style={{
                  background: "var(--surface)", border: "1px solid var(--border)",
                }}>{item.status}</span>
              </div>

              {item.status === "open" && (
                <div className="flex gap-2 mt-3">
                  <button onClick={() => updateStatus(item.id, "acknowledged")}
                    className="px-3 py-1.5 rounded text-xs bg-trace-surface border border-trace-border hover:border-trace-accent transition">
                    Acknowledge
                  </button>
                  <button onClick={() => updateStatus(item.id, "resolved")}
                    className="px-3 py-1.5 rounded text-xs bg-trace-surface border border-trace-border hover:border-trace-accent transition">
                    Resolve
                  </button>
                </div>
              )}
              {item.status === "acknowledged" && (
                <div className="flex gap-2 mt-3">
                  <button onClick={() => updateStatus(item.id, "resolved")}
                    className="px-3 py-1.5 rounded text-xs bg-trace-surface border border-trace-border hover:border-trace-accent transition">
                    Resolve
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ============ Dispatch Event Types — CRUD ============
const DISPATCH_ICONS = ["car", "radio", "compass", "alert-triangle", "eye", "shield", "zap", "map-pin", "clock", "info"];

function DispatchTypesAdmin() {
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ label: "", description: "", icon: "alert-triangle", color: "#D97706", defaultPriority: "routine", autoCloseHours: 4 });
  const toast = useToast();
  const confirm = useConfirm();

  const load = async () => {
    setLoading(true);
    const data = await api.getDispatchEventTypes();
    setTypes(Array.isArray(data) ? data : []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.label.trim()) return;
    if (editing) {
      await fetch(`${API_BASE}/dispatch/event-types/${editing}`, { method: "PUT", headers: authHeaders(), body: JSON.stringify(form) });
      toast("Updated", "success");
    } else {
      await fetch(`${API_BASE}/dispatch/event-types`, { method: "POST", headers: authHeaders(), body: JSON.stringify(form) });
      toast("Created", "success");
    }
    setEditing(null); setAdding(false);
    setForm({ label: "", description: "", icon: "alert-triangle", color: "#D97706", defaultPriority: "routine", autoCloseHours: 4 });
    load();
  };

  const remove = async (id: string) => {
    const ok = await confirm({ title: "Delete event type?", message: "Existing dispatches using this type will not be affected.", confirmLabel: "Delete" });
    if (!ok) return;
    await fetch(`${API_BASE}/dispatch/event-types/${id}`, { method: "DELETE", headers: authHeaders() });
    toast("Deleted", "info"); load();
  };

  if (loading) return <SkeletonList count={3} />;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-semibold">Dispatch Event Types</h2>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Customize the categories that appear when placing dispatch pins. Each type has an icon, color, default priority, and auto-close timer.
          </p>
        </div>
        <button onClick={() => { setAdding(true); setEditing(null); setForm({ label: "", description: "", icon: "alert-triangle", color: "#D97706", defaultPriority: "routine", autoCloseHours: 4 }); }}
          className="px-3 py-1.5 rounded text-sm font-medium" style={{ background: "var(--accent)", color: "var(--accent-text)" }}>
          + Add Type
        </button>
      </div>

      {/* List */}
      <div className="space-y-2 mb-4">
        {types.map((t) => (
          <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border border-trace-border bg-trace-surface">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold" style={{ background: t.color || "#D97706", color: "#fff" }}>
                {(t.icon || "?").slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-medium">{t.label}</div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {t.defaultPriority} · auto-close {t.autoCloseHours}h
                  {t.description && ` · ${t.description}`}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setEditing(t.id); setAdding(false); setForm({ label: t.label, description: t.description || "", icon: t.icon || "alert-triangle", color: t.color || "#D97706", defaultPriority: t.defaultPriority || "routine", autoCloseHours: t.autoCloseHours || 4 }); }}
                className="text-xs px-2 py-1 rounded" style={{ color: "var(--accent)" }}>Edit</button>
              <button onClick={() => remove(t.id)} className="text-xs px-2 py-1 rounded" style={{ color: "var(--danger)" }}>Delete</button>
            </div>
          </div>
        ))}
        {types.length === 0 && <p className="text-sm py-4 text-center" style={{ color: "var(--text-muted)" }}>No event types configured. Add one to start using dispatch pins.</p>}
      </div>

      {/* Add/Edit form */}
      {(adding || editing) && (
        <div className="p-4 rounded-lg border border-trace-border bg-trace-surface space-y-3">
          <h3 className="text-sm font-semibold">{editing ? "Edit Event Type" : "New Event Type"}</h3>

          <input placeholder="Label (e.g. Community Report)" value={form.label}
            onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))}
            className={inputCls} />

          <input placeholder="Description (optional)" value={form.description}
            onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
            className={inputCls} />

          <div className="grid grid-cols-2 gap-3">
            {/* Icon selection */}
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Icon</label>
              <div className="flex flex-wrap gap-1">
                {DISPATCH_ICONS.map((icon) => (
                  <button key={icon} onClick={() => setForm(f => ({ ...f, icon }))}
                    className="px-2 py-1 rounded text-xs"
                    style={{
                      background: form.icon === icon ? "var(--accent)" : "var(--bg)",
                      color: form.icon === icon ? "#fff" : "var(--text-sec)",
                      border: `1px solid ${form.icon === icon ? "var(--accent)" : "var(--border)"}`,
                    }}>{icon}</button>
                ))}
              </div>
            </div>

            {/* Color */}
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Color</label>
              <div className="flex gap-1 flex-wrap">
                {["#DC2626", "#D97706", "#4F46E5", "#7C3AED", "#EA580C", "#059669", "#64748B", "#0EA5E9"].map((c) => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                    className="w-7 h-7 rounded"
                    style={{ background: c, border: form.color === c ? "2px solid #fff" : "2px solid transparent" }} />
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Default priority */}
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Default Priority</label>
              <select value={form.defaultPriority} onChange={(e) => setForm(f => ({ ...f, defaultPriority: e.target.value }))}
                className={inputCls} style={{ colorScheme: "dark" }}>
                <option value="urgent">Urgent</option>
                <option value="routine">Routine</option>
                <option value="info">Info</option>
              </select>
            </div>

            {/* Auto-close hours */}
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>Auto-close after (hours)</label>
              <input type="number" min={0} max={168} value={form.autoCloseHours}
                onChange={(e) => setForm(f => ({ ...f, autoCloseHours: parseInt(e.target.value) || 0 }))}
                className={inputCls} />
              <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>0 = manual close only</p>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={save} className="px-4 py-2 rounded text-sm font-semibold"
              style={{ background: "var(--accent)", color: "var(--accent-text)" }}>
              {editing ? "Save Changes" : "Create Type"}
            </button>
            <button onClick={() => { setEditing(null); setAdding(false); }}
              className="px-4 py-2 rounded text-sm" style={{ color: "var(--text-sec)" }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}


// ============ Integrations — API key management ============
function IntegrationsAdmin() {
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [newKey, setNewKey] = useState("");
  const [testing, setTesting] = useState<string | null>(null);
  const toast = useToast();

  const load = () => {
    setLoading(true);
    fetch(`${API_BASE}/integrations`, { headers: authHeaders() })
      .then((r) => r.json()).then(setIntegrations).catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const SERVICES: Record<string, { name: string; desc: string }> = {
    carapi: { name: "CarAPI", desc: "Resolve plates to VIN, make, model, year, color." },
    spokeo: { name: "Spokeo", desc: "Identify callers by phone number." },
    bumper: { name: "Bumper", desc: "Vehicle history reports (future)." },
  };

  const handleSaveKey = async (service: string) => {
    if (!newKey.trim()) return;
    try {
      await fetch(`${API_BASE}/integrations/${service}`, {
        method: "PUT", headers: authHeaders(),
        body: JSON.stringify({ apiKey: newKey, enabled: true }),
      });
      toast.success("Key saved");
      setEditingKey(null); setNewKey(""); load();
    } catch { toast.error("Save failed"); }
  };

  const handleTest = async (service: string) => {
    setTesting(service);
    try {
      const res = await fetch(`${API_BASE}/integrations/${service}/test`, {
        method: "POST", headers: authHeaders(),
      });
      const data = await res.json();
      if (data.result === "success") toast.success(data.message || "Connected");
      else toast.error(data.message || "Test failed");
      load();
    } catch { toast.error("Test failed"); }
    setTesting(null);
  };

  const handleDelete = async (service: string) => {
    try {
      await fetch(`${API_BASE}/integrations/${service}`, { method: "DELETE", headers: authHeaders() });
      toast.success("Removed");
      load();
    } catch { toast.error("Remove failed"); }
  };

  if (loading) return <div className="text-sm" style={{ color: "var(--text-muted)" }}>Loading...</div>;

  return (
    <div>
      <p className="text-sm mb-4" style={{ color: "var(--text-sec)" }}>
        TRACE works without external services. Integrations add automatic vehicle identification and caller lookup. Each requires an API key from the respective service.
      </p>
      <div className="grid gap-4">
        {Object.entries(SERVICES).map(([key, svc]) => {
          const cfg = integrations.find((i: any) => i.serviceName === key);
          return (
            <div key={key} className="rounded-lg p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-semibold text-sm">{svc.name}</div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>{svc.desc}</div>
                </div>
                {cfg?.configured && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{
                    background: cfg.enabled ? "rgba(22,163,74,0.1)" : "rgba(148,163,184,0.1)",
                    color: cfg.enabled ? "#16A34A" : "var(--text-muted)",
                  }}>{cfg.enabled ? "Active" : "Disabled"}</span>
                )}
              </div>

              {cfg?.configured ? (
                <div className="flex items-center gap-2 mt-3">
                  <button onClick={() => handleTest(key)} disabled={testing === key}
                    className="px-3 py-1.5 rounded text-xs font-medium transition"
                    style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", color: "var(--text-sec)" }}>
                    {testing === key ? "Testing..." : "Test"}
                  </button>
                  {cfg.lastTestResult && (
                    <span className="text-[10px]" style={{ color: cfg.lastTestResult === "success" ? "#16A34A" : "#DC2626" }}>
                      {cfg.lastTestResult}
                    </span>
                  )}
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {cfg.lookupsThisMonth} lookups this month
                  </span>
                  <button onClick={() => handleDelete(key)} className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>Remove</button>
                </div>
              ) : editingKey === key ? (
                <div className="flex gap-2 mt-3">
                  <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="Paste API key"
                    className="flex-1 rounded px-3 py-2 text-sm" type="password"
                    style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", color: "var(--text)" }} />
                  <button onClick={() => handleSaveKey(key)}
                    className="px-3 py-2 rounded text-sm font-semibold"
                    style={{ background: "var(--accent)", color: "var(--accent-text)" }}>Save</button>
                  <button onClick={() => { setEditingKey(null); setNewKey(""); }}
                    className="px-3 py-2 rounded text-sm" style={{ color: "var(--text-muted)" }}>Cancel</button>
                </div>
              ) : (
                <button onClick={() => setEditingKey(key)}
                  className="mt-3 px-3 py-1.5 rounded text-xs font-medium transition"
                  style={{ background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid var(--accent)" }}>
                  Configure
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ============ Import — data import from spreadsheets ============
function ImportAdmin() {
  const [hasDemoData, setHasDemoData] = useState<boolean | null>(null);
  const [clearing, setClearing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const toast = useToast();

  useEffect(() => {
    fetch(`${API_BASE}/import/status`, { headers: authHeaders() })
      .then((r) => r.json()).then((d) => setHasDemoData(d.hasDemoData)).catch(() => {});
  }, []);

  const handleClearDemo = async () => {
    setClearing(true);
    try {
      const res = await fetch(`${API_BASE}/import/clear-demo`, { method: "POST", headers: authHeaders() });
      const data = await res.json();
      toast.success(`Cleared ${data.vehiclesCleared} vehicles, ${data.sightingsCleared} sightings, ${data.actorsCleared} actors`);
      setHasDemoData(false);
    } catch { toast.error("Clear failed"); }
    setClearing(false);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true); setPreview(null); setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const token = localStorage.getItem("trace_op_token");
      const res = await fetch(`${API_BASE}/import/preview`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form,
      });
      const data = await res.json();
      setPreview(data);
    } catch { toast.error("Upload failed"); }
    setUploading(false);
  };

  const handleImport = async () => {
    if (!preview?.tempFile) return;
    setImporting(true);
    try {
      const res = await fetch(`${API_BASE}/import/run`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ tempFile: preview.tempFile }),
      });
      const data = await res.json();
      setResult(data);
      toast.success("Import complete");
    } catch { toast.error("Import failed"); }
    setImporting(false);
  };

  return (
    <div>
      <p className="text-sm mb-4" style={{ color: "var(--text-sec)" }}>
        Import existing vehicle data from Excel (.xlsx) or CSV files. The system auto-maps columns, previews the import, and lets you confirm before writing to the database.
      </p>

      {/* Demo data warning */}
      {hasDemoData && (
        <div className="rounded-lg p-4 mb-4" style={{ background: "rgba(217,119,6,0.06)", border: "1px solid rgba(217,119,6,0.3)" }}>
          <div className="text-sm font-medium mb-1" style={{ color: "#D97706" }}>Demo data detected</div>
          <p className="text-xs mb-3" style={{ color: "var(--text-sec)" }}>
            Your database contains seed data (DEMO/FAKE/TEST records). Clear it before importing real data to avoid mixing test records with real intelligence.
          </p>
          <button onClick={handleClearDemo} disabled={clearing}
            className="px-3 py-1.5 rounded text-xs font-medium"
            style={{ background: "#D97706", color: "#fff" }}>
            {clearing ? "Clearing..." : "Clear Demo Data"}
          </button>
        </div>
      )}

      {/* File upload */}
      <div className="rounded-lg p-4 mb-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <label className="text-xs font-medium block mb-2" style={{ color: "var(--text-sec)" }}>Select file</label>
        <input type="file" accept=".xlsx,.xls,.csv,.tsv"
          onChange={(e) => { setFile(e.target.files?.[0] || null); setPreview(null); setResult(null); }}
          className="text-sm" style={{ color: "var(--text)" }} />
        {file && (
          <button onClick={handleUpload} disabled={uploading}
            className="ml-3 px-3 py-1.5 rounded text-xs font-semibold"
            style={{ background: "var(--accent)", color: "var(--accent-text)" }}>
            {uploading ? "Analyzing..." : "Preview Import"}
          </button>
        )}
      </div>

      {/* Preview */}
      {preview && !result && (
        <div className="rounded-lg p-4 mb-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="text-sm font-medium mb-2">Import Preview: {preview.fileName}</div>
          <div className="grid grid-cols-4 gap-3 text-center mb-3">
            <div><div className="text-lg font-bold">{preview.totalRows}</div><div className="text-[10px]" style={{ color: "var(--text-muted)" }}>Total rows</div></div>
            <div><div className="text-lg font-bold" style={{ color: "#16A34A" }}>{preview.validRows}</div><div className="text-[10px]" style={{ color: "var(--text-muted)" }}>Valid</div></div>
            <div><div className="text-lg font-bold" style={{ color: "#DC2626" }}>{preview.errorRows}</div><div className="text-[10px]" style={{ color: "var(--text-muted)" }}>Errors</div></div>
            <div><div className="text-lg font-bold" style={{ color: "var(--text-muted)" }}>{preview.duplicates}</div><div className="text-[10px]" style={{ color: "var(--text-muted)" }}>Duplicates</div></div>
          </div>
          {preview.unmappedColumns?.length > 0 && (
            <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
              Unmapped columns (skipped): {preview.unmappedColumns.join(", ")}
            </p>
          )}
          <button onClick={handleImport} disabled={importing || preview.validRows === 0}
            className="px-4 py-2 rounded text-sm font-semibold"
            style={{ background: "var(--accent)", color: "var(--accent-text)" }}>
            {importing ? "Importing..." : `Import ${preview.validRows} rows`}
          </button>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="rounded-lg p-4" style={{ background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.3)" }}>
          <div className="text-sm font-medium mb-1" style={{ color: "#16A34A" }}>Import complete</div>
          <div className="text-xs" style={{ color: "var(--text-sec)" }}>
            {result.totalRows} rows processed. {result.validRows} imported, {result.errorRows} errors, {result.duplicates} duplicates skipped.
          </div>
        </div>
      )}
    </div>
  );
}
