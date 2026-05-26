/**
 * TRACE Operator — Vehicle List + Dossier
 */
import { useState, useEffect } from "react";
import { api } from "../lib/api.js";
import { IntelMap } from "../components/map-view.js";
import { Icon } from "../components/icon.js";
import { useToast, EmptyState, EMPTY_STATES, SkeletonList, HelpTip, ErrorBoundary } from "../components/ux/index.js";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3100/api/v1";

export function Vehicles() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    setLoading(true);
    api.getVehicles()
      .then(setVehicles)
      .catch(() => toast("Failed to load vehicles", "error"))
      .finally(() => setLoading(false));
  }, []);

  const handleSearch = async () => {
    if (search.length < 2) {
      toast("Enter at least 2 characters to search", "info");
      return;
    }
    setLoading(true);
    try {
      const results = await api.searchVehicles(search);
      setVehicles(results);
      if (results.length === 0) toast("No vehicles found", "info");
    } catch {
      toast("Search failed", "error");
    }
    setLoading(false);
  };

  return (
    <div className="flex gap-6">
      <div className="w-80">
        <div className="flex gap-2 mb-4">
          <input placeholder="Search plate or description..." value={search}
            onChange={(e) => setSearch(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1 bg-trace-bg border border-trace-border rounded-lg px-3 py-2 text-sm focus:border-trace-accent focus:outline-none transition-colors"
          />
          <button onClick={handleSearch}
            className="bg-trace-accent text-trace-bg px-3 rounded-lg text-sm font-semibold hover:opacity-90 transition">
            Go
          </button>
        </div>

        {loading ? (
          <SkeletonList count={5} />
        ) : vehicles.length === 0 ? (
          <EmptyState {...EMPTY_STATES.vehicles} />
        ) : (
          <div className="space-y-2 max-h-[calc(100vh-8rem)] overflow-auto">
            {vehicles.map((v) => (
              <button key={v.id} onClick={() => setSelected(v)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selected?.id === v.id
                    ? "border-trace-accent bg-trace-surface"
                    : "border-trace-border bg-trace-bg hover:bg-trace-surface"
                }`}
              >
                <div className="font-mono font-bold tracking-wider">{v.plate || "No plate"}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {[v.color, v.year, v.make, v.model].filter(Boolean).join(" ") || "Unknown vehicle"}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected ? (
        <div className="flex-1">
          <ErrorBoundary fallbackMessage="Failed to render vehicle dossier">
            <VehicleDossier vehicle={selected} />
          </ErrorBoundary>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-600 text-sm">Select a vehicle to view its dossier</p>
        </div>
      )}
    </div>
  );
}

function VehicleDossier({ vehicle }: { vehicle: any }) {
  const [corridorData, setCorridorData] = useState<any[]>([]);
  const [sightingMarkers, setSightingMarkers] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("trace_op_token");
    const headers: any = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    fetch(`${API_BASE}/geo/corridor/${vehicle.id}`, { headers })
      .then((r) => r.ok ? r.json() : [])
      .then((segments) => setCorridorData(Array.isArray(segments) ? segments : []))
      .catch(() => {});

    fetch(`${API_BASE}/sightings?vehicleId=${vehicle.id}`, { headers })
      .then((r) => r.ok ? r.json() : [])
      .then((sightings: any[]) => {
        const arr = Array.isArray(sightings) ? sightings : [];
        setSightingMarkers(
          arr.filter((s) => s.lat).map((s) => ({
            lat: s.lat, lng: s.lng, color: "#4fc3f7",
            popup: `${new Date(s.observedAt).toLocaleDateString()} - ${s.activityDescription || "sighting"}`,
          }))
        );
      })
      .catch(() => {});
  }, [vehicle.id]);

  return (
    <div className="bg-trace-surface rounded-lg p-6 border border-trace-border">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-mono font-bold tracking-widest">
            {vehicle.plate || "No plate"}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {[vehicle.color, vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")}
          </p>
        </div>
        <span className={`text-xs px-2 py-1 rounded ${
          vehicle.status === "active" ? "bg-trace-confirm/20 text-trace-confirm" :
          vehicle.status === "retired" ? "bg-gray-700 text-gray-400" :
          "bg-trace-warning/20 text-trace-warning"
        }`}>{vehicle.status}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
        <Field label="Make" value={vehicle.make} />
        <Field label="Model" value={vehicle.model} />
        <Field label="Year" value={vehicle.year} />
        <Field label="Color" value={vehicle.color} />
        <Field label="Last Seen" value={vehicle.lastSeenAt ? new Date(vehicle.lastSeenAt).toLocaleDateString() : null} />
        <Field label="Created" value={new Date(vehicle.createdAt).toLocaleDateString()} />
      </div>

      {vehicle.description && (
        <div className="mb-4">
          <label className="text-xs text-gray-500 uppercase tracking-wider">Description</label>
          <p className="mt-1 text-gray-300 text-sm">{vehicle.description}</p>
        </div>
      )}

      {sightingMarkers.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-2">
            <label className="text-xs text-gray-500 uppercase tracking-wider">Sighting Locations</label>
            <HelpTip text="Map shows all recorded sighting locations for this vehicle with movement corridor" />
          </div>
          <IntelMap
            markers={sightingMarkers}
            corridors={corridorData.length > 0 ? [{ vehicleId: vehicle.id, color: "#e74c3c", segments: corridorData }] : []}
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
      <label className="text-xs text-gray-500 uppercase tracking-wider">{label}</label>
      <p className="mt-1 text-sm">{value || <span className="text-gray-600">-</span>}</p>
    </div>
  );
}
