/**
 * TRACE Operator — Vehicle List + Dossier + CRUD
 */
import { useState, useEffect } from "react";
import { api } from "../lib/api.js";
import { IntelMap } from "../components/map-view.js";
import { Icon } from "../components/icon.js";
import { useToast, useConfirm, EmptyState, EMPTY_STATES, SkeletonList, HelpTip, ErrorBoundary } from "../components/ux/index.js";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3100/api/v1";
const inputCls = "w-full bg-trace-bg border border-trace-border rounded-lg px-3 py-2 text-sm focus:border-trace-accent focus:outline-none transition-colors";

export function Vehicles() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const toast = useToast();

  const load = () => {
    setLoading(true);
    api.getVehicles()
      .then(setVehicles)
      .catch(() => toast("Failed to load vehicles", "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSearch = async () => {
    if (search.length < 2) { toast("Enter at least 2 characters", "info"); return; }
    setLoading(true);
    try {
      const results = await api.searchVehicles(search);
      setVehicles(results);
      if (results.length === 0) toast("No vehicles found", "info");
    } catch { toast("Search failed", "error"); }
    setLoading(false);
  };

  const handleCreated = (v: any) => {
    setVehicles((prev) => [v, ...prev]);
    setSelected(v);
    setAdding(false);
    toast("Vehicle created", "success");
  };

  const handleUpdated = (v: any) => {
    setVehicles((prev) => prev.map((x) => x.id === v.id ? v : x));
    setSelected(v);
  };

  const handleRetired = (id: string) => {
    setVehicles((prev) => prev.filter((x) => x.id !== id));
    setSelected(null);
    toast("Vehicle retired", "success");
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
      <div className="w-full lg:w-80 lg:flex-shrink-0">
        <div className="flex gap-2 mb-3">
          <input placeholder="Search plate or description..." value={search}
            onChange={(e) => setSearch(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className={`flex-1 ${inputCls}`} />
          <button onClick={handleSearch}
            className="bg-trace-accent text-trace-bg px-3 rounded-lg text-sm font-semibold hover:opacity-90 transition">Go</button>
        </div>

        <button onClick={() => setAdding(!adding)}
          className="w-full mb-3 px-3 py-2 rounded-lg text-sm border border-dashed border-trace-border text-trace-accent hover:bg-trace-surface transition flex items-center justify-center gap-2">
          <Icon name="plus" size={14} /> Add Vehicle
        </button>

        {loading ? <SkeletonList count={5} /> : vehicles.length === 0 ? <EmptyState {...EMPTY_STATES.vehicles} /> : (
          <div className="space-y-2 max-h-[50vh] lg:max-h-[calc(100vh-12rem)] overflow-auto">
            {vehicles.map((v) => (
              <button key={v.id} onClick={() => { setSelected(v); setAdding(false); }}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selected?.id === v.id ? "border-trace-accent bg-trace-surface" : "border-trace-border bg-trace-bg hover:bg-trace-surface"
                }`}>
                <div className="font-mono font-bold tracking-wider">{v.plate || "No plate"}</div>
                <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  {[v.color, v.year, v.make, v.model].filter(Boolean).join(" ") || "Unknown vehicle"}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1">
        {adding ? (
          <AddVehicleForm onCreated={handleCreated} onCancel={() => setAdding(false)} />
        ) : selected ? (
          <ErrorBoundary fallbackMessage="Failed to render vehicle dossier">
            <VehicleDossier vehicle={selected} onUpdated={handleUpdated} onRetired={handleRetired} />
          </ErrorBoundary>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Select a vehicle or add a new one</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AddVehicleForm({ onCreated, onCancel }: { onCreated: (v: any) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ plate: "", make: "", model: "", year: "", color: "", description: "" });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const handleSave = async () => {
    if (!form.plate.trim()) { toast("Plate is required", "warning"); return; }
    setSaving(true);
    try {
      const v = await api.createVehicle({ ...form, year: form.year ? parseInt(form.year) : undefined });
      onCreated(v);
    } catch { toast("Failed to create vehicle", "error"); }
    setSaving(false);
  };

  return (
    <div className="bg-trace-surface rounded-lg p-6 border border-trace-border max-w-lg">
      <h2 className="text-lg font-semibold mb-4">Add Vehicle</h2>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="col-span-2">
          <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>Plate</label>
          <input value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value.toUpperCase() })} className={inputCls} placeholder="ABC-1234" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>Make</label>
          <input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} className={inputCls} placeholder="Honda" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>Model</label>
          <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className={inputCls} placeholder="Civic" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>Year</label>
          <input value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} className={inputCls} placeholder="2021" type="number" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>Color</label>
          <input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className={inputCls} placeholder="Black" />
        </div>
        <div className="col-span-2">
          <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>Description</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} rows={2} placeholder="Distinguishing features, damage, modifications" />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-sec)" }}>Cancel</button>
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--accent)", color: "var(--accent-text)" }}>
          {saving ? "Saving..." : "Create Vehicle"}
        </button>
      </div>
    </div>
  );
}

function VehicleDossier({ vehicle, onUpdated, onRetired }: { vehicle: any; onUpdated: (v: any) => void; onRetired: (id: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ plate: "", make: "", model: "", year: "", color: "", description: "" });
  const [sightingMarkers, setSightingMarkers] = useState<any[]>([]);
  const [corridorData, setCorridorData] = useState<any[]>([]);
  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    const token = localStorage.getItem("trace_op_token");
    const headers: any = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };

    fetch(`${API_BASE}/geo/corridor/${vehicle.id}`, { headers })
      .then((r) => r.ok ? r.json() : [])
      .then((segments) => setCorridorData(Array.isArray(segments) ? segments : []))
      .catch(() => {});

    fetch(`${API_BASE}/sightings?vehicleId=${vehicle.id}`, { headers })
      .then((r) => r.ok ? r.json() : [])
      .then((sightings: any[]) => {
        const arr = Array.isArray(sightings) ? sightings : [];
        setSightingMarkers(arr.filter((s) => s.lat).map((s) => ({
          lat: s.lat, lng: s.lng, color: "#818CF8",
          popup: `${new Date(s.observedAt).toLocaleDateString()} - ${s.activityDescription || "sighting"}`,
        })));
      })
      .catch(() => {});
  }, [vehicle.id]);

  const startEdit = () => {
    setForm({
      plate: vehicle.plate || "", make: vehicle.make || "", model: vehicle.model || "",
      year: vehicle.year ? String(vehicle.year) : "", color: vehicle.color || "", description: vehicle.description || "",
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    try {
      const updated = await api.updateVehicle(vehicle.id, { ...form, year: form.year ? parseInt(form.year) : undefined });
      onUpdated(updated);
      setEditing(false);
      toast("Vehicle updated", "success");
    } catch { toast("Failed to update", "error"); }
  };

  const handleRetire = async () => {
    const ok = await confirm({
      title: `Retire "${vehicle.plate}"?`,
      message: "The vehicle will be removed from active tracking. Sighting history is preserved. This can be reversed in the database.",
      confirmLabel: "Retire",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.updateVehicle(vehicle.id, { status: "retired" });
      onRetired(vehicle.id);
    } catch { toast("Failed to retire", "error"); }
  };

  return (
    <div className="bg-trace-surface rounded-lg p-6 border border-trace-border">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-mono font-bold tracking-widest">{vehicle.plate || "No plate"}</h2>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {[vehicle.color, vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded ${
            vehicle.status === "active" ? "bg-trace-confirm/20 text-trace-confirm" :
            vehicle.status === "retired" ? "bg-gray-700 text-gray-400" :
            "bg-trace-warning/20 text-trace-warning"
          }`}>{vehicle.status}</span>
          {!editing && (
            <>
              <button onClick={startEdit} className="p-1.5 rounded hover:bg-trace-bg transition" title="Edit vehicle">
                <Icon name="sliders" size={14} />
              </button>
              <button onClick={handleRetire} className="p-1.5 rounded hover:bg-trace-bg transition" title="Retire vehicle" style={{ color: "var(--danger)" }}>
                <Icon name="x" size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div><label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>Plate</label>
            <input value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value.toUpperCase() })} className={inputCls} /></div>
          <div><label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>Color</label>
            <input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className={inputCls} /></div>
          <div><label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>Make</label>
            <input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} className={inputCls} /></div>
          <div><label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>Model</label>
            <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className={inputCls} /></div>
          <div className="col-span-2"><label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} rows={2} /></div>
          <div className="col-span-2 flex gap-2">
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-sec)" }}>Cancel</button>
            <button onClick={saveEdit} className="px-3 py-1.5 rounded text-sm font-semibold" style={{ background: "var(--accent)", color: "var(--accent-text)" }}>Save</button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <Field label="Make" value={vehicle.make} />
          <Field label="Model" value={vehicle.model} />
          <Field label="Year" value={vehicle.year} />
          <Field label="Color" value={vehicle.color} />
          <Field label="Last Seen" value={vehicle.lastSeenAt ? new Date(vehicle.lastSeenAt).toLocaleDateString() : null} />
          <Field label="Created" value={new Date(vehicle.createdAt).toLocaleDateString()} />
        </div>
      )}

      {!editing && vehicle.description && (
        <div className="mb-4">
          <label className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Description</label>
          <p className="mt-1 text-sm" style={{ color: "var(--text-sec)" }}>{vehicle.description}</p>
        </div>
      )}

      {sightingMarkers.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-2">
            <label className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Sighting Locations</label>
            <HelpTip text="Map shows all recorded sighting locations for this vehicle. Highlighted markers indicate this vehicle's sightings." />
          </div>
          <IntelMap
            highlightedMarkers={sightingMarkers}
            corridors={corridorData.length > 0 ? [{ vehicleId: vehicle.id, color: "#4F46E5", segments: corridorData }] : []}
            height="280px"
          />
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</label>
      <p className="mt-1 text-sm">{value || <span style={{ color: "var(--text-muted)" }}>-</span>}</p>
    </div>
  );
}
