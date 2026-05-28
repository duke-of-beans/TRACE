/**
 * TRACE Operator — Vehicle List + Record + CRUD
 */
import { useState, useEffect, useRef } from "react";
import { api } from "../lib/api.js";
import { IntelMap } from "../components/map-view.js";
import { Icon } from "../components/icon.js";
import { useToast, useConfirm, EmptyState, EMPTY_STATES, SkeletonList, HelpTip, ErrorBoundary } from "../components/ux/index.js";

const API_BASE = import.meta.env.VITE_API_URL || "/api/v1";
const inputCls = "w-full bg-trace-bg border border-trace-border rounded-lg px-3 py-2 text-sm focus:border-trace-accent focus:outline-none transition-colors";

export function Vehicles() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "groups">("list");
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const toast = useToast();

  const load = () => {
    setLoading(true);
    api.getVehicles()
      .then(setVehicles)
      .catch(() => toast("Failed to load vehicles", "error"))
      .finally(() => setLoading(false));
  };

  const loadGroups = () => {
    api.getVehicleGroups()
      .then((g) => setGroups(Array.isArray(g) ? g : []))
      .catch(() => {});
  };

  useEffect(() => { load(); loadGroups(); }, []);

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
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>Every vehicle your chapter tracks. Search by plate, make, or model. Click to view full record with sighting history and linked actors.</p>

        {/* View toggle: All Vehicles | Groups */}
        <div className="flex gap-1 mb-3 p-1 rounded-lg" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
          <button onClick={() => setViewMode("list")}
            className="flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors"
            style={{ background: viewMode === "list" ? "var(--accent)" : "transparent", color: viewMode === "list" ? "var(--accent-text)" : "var(--text-sec)" }}>
            All Vehicles
          </button>
          <button onClick={() => { setViewMode("groups"); loadGroups(); }}
            className="flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors"
            style={{ background: viewMode === "groups" ? "var(--accent)" : "transparent", color: viewMode === "groups" ? "var(--accent-text)" : "var(--text-sec)" }}>
            Groups {groups.length > 0 && <span style={{ opacity: 0.7 }}>({groups.length})</span>}
          </button>
        </div>

        {viewMode === "list" ? (<>
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
                <div className="flex items-center gap-3">
                  {v.photoUrl ? (
                    <img src={v.photoUrl} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                      <Icon name="car" size={14} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-mono font-bold tracking-wider">{v.plate || "No plate"}</div>
                    <div className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                      {[v.color, v.year, v.make, v.model].filter(Boolean).join(" ") || "Unknown vehicle"}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
        </>) : (
          /* Groups view */
          <div>
            <button onClick={() => setCreatingGroup(true)}
              className="w-full mb-3 px-3 py-2 rounded-lg text-sm border border-dashed border-trace-border text-trace-accent hover:bg-trace-surface transition flex items-center justify-center gap-2">
              <Icon name="plus" size={14} /> New Group
            </button>

            {creatingGroup && (
              <div className="mb-3 p-3 rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <input placeholder="Group name (e.g. Convoy Team A)" value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newGroupName.trim()) {
                      api.createVehicleGroup({ name: newGroupName.trim() })
                        .then(() => { loadGroups(); setNewGroupName(""); setCreatingGroup(false); toast("Group created", "success"); })
                        .catch(() => toast("Failed to create group", "error"));
                    }
                  }}
                  className={inputCls} autoFocus />
                <div className="flex gap-2 mt-2">
                  <button onClick={() => {
                    if (!newGroupName.trim()) return;
                    api.createVehicleGroup({ name: newGroupName.trim() })
                      .then(() => { loadGroups(); setNewGroupName(""); setCreatingGroup(false); toast("Group created", "success"); })
                      .catch(() => toast("Failed to create group", "error"));
                  }} className="flex-1 px-3 py-1.5 rounded text-xs font-semibold" style={{ background: "var(--accent)", color: "var(--accent-text)" }}>Create</button>
                  <button onClick={() => { setCreatingGroup(false); setNewGroupName(""); }} className="px-3 py-1.5 rounded text-xs" style={{ color: "var(--text-muted)" }}>Cancel</button>
                </div>
              </div>
            )}

            {groups.length === 0 && !creatingGroup && (
              <div className="text-center py-8">
                <div style={{ color: "var(--text-muted)" }}><Icon name="car" size={32} /></div>
                <p className="text-sm mt-2 font-medium">No groups yet</p>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Group vehicles for fast dispatch. Create a group and add vehicles to it.</p>
              </div>
            )}

            <div className="space-y-2 max-h-[50vh] lg:max-h-[calc(100vh-14rem)] overflow-auto">
              {groups.map((g) => (
                <button key={g.id} onClick={() => setSelectedGroup(selectedGroup?.id === g.id ? null : g)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedGroup?.id === g.id ? "border-trace-accent bg-trace-surface" : "border-trace-border bg-trace-bg hover:bg-trace-surface"
                  }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-sm">{g.name}</div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {g.memberCount || 0} vehicle{(g.memberCount || 0) !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <div className="flex -space-x-2">
                      {(g.members || []).slice(0, 4).map((m: any) => (
                        m.photoUrl ? (
                          <img key={m.vehicleId} src={m.photoUrl} alt="" className="w-7 h-7 rounded border-2" style={{ borderColor: "var(--surface)", objectFit: "cover" }} />
                        ) : (
                          <div key={m.vehicleId} className="w-7 h-7 rounded border-2 flex items-center justify-center" style={{ borderColor: "var(--surface)", background: "var(--bg)" }}>
                            <Icon name="car" size={10} />
                          </div>
                        )
                      ))}
                      {(g.members || []).length > 4 && (
                        <div className="w-7 h-7 rounded border-2 flex items-center justify-center text-[9px] font-bold" style={{ borderColor: "var(--surface)", background: "var(--bg)", color: "var(--text-muted)" }}>
                          +{g.members.length - 4}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1">
        {viewMode === "groups" && selectedGroup ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold">{selectedGroup.name}</h2>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{selectedGroup.memberCount || 0} vehicles in this group</p>
              </div>
              <button onClick={async () => {
                await api.deleteVehicleGroup(selectedGroup.id).catch(() => {});
                setSelectedGroup(null);
                loadGroups();
                toast("Group deleted", "success");
              }} className="text-xs px-3 py-1.5 rounded" style={{ color: "var(--danger)", border: "1px solid var(--border)" }}>Delete Group</button>
            </div>

            {/* Members */}
            <div className="space-y-2 mb-6">
              {(selectedGroup.members || []).map((m: any) => (
                <div key={m.vehicleId} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  {m.photoUrl ? (
                    <img src={m.photoUrl} alt="" className="w-10 h-10 rounded object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded flex items-center justify-center" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                      <Icon name="car" size={14} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-mono font-bold tracking-wider text-sm">{m.plate}</div>
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>{[m.color, m.make, m.model].filter(Boolean).join(" ")}</div>
                  </div>
                  <button onClick={async () => {
                    await api.removeFromVehicleGroup(selectedGroup.id, m.vehicleId);
                    loadGroups();
                    const updated = groups.find((g: any) => g.id === selectedGroup.id);
                    if (updated) setSelectedGroup({ ...updated, members: (updated.members || []).filter((x: any) => x.vehicleId !== m.vehicleId), memberCount: (updated.memberCount || 1) - 1 });
                    toast("Removed from group", "info");
                  }} className="text-xs px-2 py-1 rounded" style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}>Remove</button>
                </div>
              ))}
            </div>

            {/* Add vehicles */}
            <div className="rounded-lg p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-sec)" }}>Add vehicles to this group</p>
              <div className="space-y-1 max-h-48 overflow-auto">
                {vehicles
                  .filter((v) => !(selectedGroup.members || []).some((m: any) => m.vehicleId === v.id))
                  .slice(0, 20)
                  .map((v) => (
                  <button key={v.id} onClick={async () => {
                    await api.addToVehicleGroup(selectedGroup.id, [v.id]);
                    loadGroups();
                    setTimeout(() => {
                      const updated = groups.find((g: any) => g.id === selectedGroup.id);
                      if (updated) setSelectedGroup(updated);
                      else loadGroups();
                    }, 300);
                    toast(`Added ${v.plate} to group`, "success");
                  }} className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-trace-bg transition">
                    <span className="font-mono font-bold">{v.plate}</span>
                    <span style={{ color: "var(--text-muted)" }}>{[v.color, v.make, v.model].filter(Boolean).join(" ")}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : adding ? (
          <AddVehicleForm onCreated={handleCreated} onCancel={() => setAdding(false)} />
        ) : selected ? (
          <ErrorBoundary fallbackMessage="Failed to render vehicle record">
            <VehicleRecord vehicle={selected} onUpdated={handleUpdated} onRetired={handleRetired} />
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

function VehicleRecord({ vehicle, onUpdated, onRetired }: { vehicle: any; onUpdated: (v: any) => void; onRetired: (id: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ plate: "", make: "", model: "", year: "", color: "", description: "" });
  const [sightingMarkers, setSightingMarkers] = useState<any[]>([]);
  const [corridorData, setCorridorData] = useState<any[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [vehiclePhotos, setVehiclePhotos] = useState<any[]>([]);
  const [photoDesc, setPhotoDesc] = useState("");
  const [behaviorData, setBehaviorData] = useState<any>(null);
  const [coOccData, setCoOccData] = useState<any[]>([]);
  const photoRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const confirm = useConfirm();

  // Load photos
  const loadPhotos = () => {
    api.getVehiclePhotos(vehicle.id).then((p) => setVehiclePhotos(Array.isArray(p) ? p : [])).catch(() => {});
  };

  useEffect(() => {
    loadPhotos();
  }, [vehicle.id]);

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

    // Load behavior report for this vehicle
    api.getBehaviorReport({ vehicleId: vehicle.id }).then((r) => {
      setBehaviorData(Array.isArray(r) && r.length > 0 ? r[0] : null);
    }).catch(() => {});

    // Load co-occurrence data
    api.getCoOccurrenceReport().then((r) => {
      const relevant = (Array.isArray(r) ? r : []).filter((p: any) =>
        p.vehicleA?.id === vehicle.id || p.vehicleB?.id === vehicle.id
      );
      setCoOccData(relevant);
    }).catch(() => {});
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

      {/* Photo Gallery */}
      <input ref={photoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingPhoto(true);
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const photoUrl = reader.result as string;
            const isFirst = vehiclePhotos.length === 0;
            await api.addVehiclePhoto(vehicle.id, { photoUrl, description: photoDesc || undefined, isPrimary: isFirst });
            setPhotoDesc("");
            loadPhotos();
            // Refresh vehicle to get updated banner
            const updated = await api.getVehicle(vehicle.id);
            if (updated) onUpdated(updated);
            toast("Photo added", "success");
          } catch { toast("Photo upload failed", "error"); }
          setUploadingPhoto(false);
        };
        reader.readAsDataURL(file);
      }} />
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Photos ({vehiclePhotos.length})</label>
          <button onClick={() => photoRef.current?.click()}
            className="text-xs px-2 py-1 rounded" style={{ color: "var(--accent)", border: "1px solid var(--border)" }}>
            {uploadingPhoto ? "Uploading..." : "+ Add Photo"}
          </button>
        </div>
        {vehiclePhotos.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 6 }}>
            {vehiclePhotos.map((p: any) => (
              <div key={p.id} className="relative group" style={{ aspectRatio: "1", borderRadius: 8, overflow: "hidden", border: p.isPrimary ? "2px solid var(--accent)" : "1px solid var(--border)" }}>
                <img src={p.photoUrl} alt={p.description || ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                {p.isPrimary && (
                  <span style={{ position: "absolute", top: 2, left: 2, fontSize: 8, padding: "1px 4px", borderRadius: 3, background: "var(--accent)", color: "#fff", fontWeight: 700 }}>PRIMARY</span>
                )}
                {p.description && (
                  <span style={{ position: "absolute", bottom: 0, left: 0, right: 0, fontSize: 9, padding: "2px 4px", background: "rgba(0,0,0,0.7)", color: "#ccc", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.description}</span>
                )}
                {/* Hover actions */}
                <div className="opacity-0 group-hover:opacity-100" style={{ position: "absolute", top: 2, right: 2, display: "flex", gap: 2, transition: "opacity 0.15s" }}>
                  {!p.isPrimary && (
                    <button onClick={async () => {
                      await api.updateVehiclePhoto(vehicle.id, p.id, { isPrimary: true });
                      loadPhotos();
                      const updated = await api.getVehicle(vehicle.id);
                      if (updated) onUpdated(updated);
                      toast("Set as primary", "success");
                    }} style={{ background: "rgba(0,0,0,0.7)", color: "#fff", border: "none", borderRadius: 3, fontSize: 9, padding: "2px 4px", cursor: "pointer" }}>★</button>
                  )}
                  <button onClick={async () => {
                    const ok = await confirm({ title: "Delete this photo?", message: "This cannot be undone.", confirmLabel: "Delete", danger: true });
                    if (!ok) return;
                    await api.deleteVehiclePhoto(vehicle.id, p.id);
                    loadPhotos();
                    const updated = await api.getVehicle(vehicle.id);
                    if (updated) onUpdated(updated);
                    toast("Photo deleted", "info");
                  }} style={{ background: "rgba(0,0,0,0.7)", color: "#ef4444", border: "none", borderRadius: 3, fontSize: 9, padding: "2px 4px", cursor: "pointer" }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <button onClick={() => photoRef.current?.click()}
            className="w-full h-32 rounded-lg flex flex-col items-center justify-center gap-1 transition"
            style={{ border: "1px dashed var(--border)", color: "var(--text-muted)" }}>
            <Icon name="camera" size={20} />
            <span className="text-xs">{uploadingPhoto ? "Uploading..." : "Add Photo"}</span>
          </button>
        )}
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

      {/* Activity Patterns */}
      {behaviorData && behaviorData.clusters?.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-2">
            <label className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Activity Patterns</label>
            <HelpTip text="Locations where this vehicle has been seen repeatedly, with time-of-day patterns." />
          </div>
          <div className="space-y-2">
            {behaviorData.clusters.map((c: any, i: number) => (
              <div key={i} className="rounded-lg p-3" style={{ background: "var(--surface-alt, var(--bg))", border: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium" style={{ color: "var(--text-sec)" }}>
                    {c.locationDescription || `${c.centerLat.toFixed(4)}, ${c.centerLng.toFixed(4)}`}
                  </span>
                  <span className="text-sm font-bold" style={{ color: "var(--accent)" }}>{c.sightingCount}×</span>
                </div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {c.dates.slice(0, 5).join(", ")}{c.dates.length > 5 ? ` +${c.dates.length - 5} more` : ""}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {Object.entries(c.timeOfDay).sort(([, a]: any, [, b]: any) => b - a).slice(0, 4).map(([time, count]: any) => (
                    <span key={time} className="text-[10px] px-1.5 py-0.5 rounded"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-sec)" }}>
                      {time}: {count}×
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Frequently Seen With */}
      {coOccData.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-2">
            <label className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Frequently Seen With</label>
            <HelpTip text="Other vehicles that have appeared near this vehicle within a short time window. May indicate coordination." />
          </div>
          <div className="space-y-2">
            {coOccData.map((pair: any, i: number) => {
              const other = pair.vehicleA?.id === vehicle.id ? pair.vehicleB : pair.vehicleA;
              return (
                <div key={i} className="flex items-center justify-between rounded-lg p-3"
                  style={{ background: "var(--surface-alt, var(--bg))", border: "1px solid var(--border)", cursor: "pointer" }}
                  onClick={() => window.dispatchEvent(new CustomEvent("trace-navigate", { detail: "vehicles" }))}>
                  <div>
                    <span className="font-mono font-bold tracking-wider text-sm">{other.plate || "?"}</span>
                    <span className="text-xs ml-2" style={{ color: "var(--text-muted)" }}>{[other.color, other.make, other.model].filter(Boolean).join(" ")}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold" style={{ color: pair.encounters >= 4 ? "#ef4444" : "var(--accent)" }}>{pair.encounters}×</span>
                    <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {new Date(pair.firstSeen).toLocaleDateString()} — {new Date(pair.lastSeen).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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
