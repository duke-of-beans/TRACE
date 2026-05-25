/**
 * TRACE Operator — Vehicle List + Dossier
 */
import { useState, useEffect } from "react";
import { api } from "../lib/api.js";
import { IntelMap } from "../components/map-view.js";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3100/api/v1";

export function Vehicles() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    api.getVehicles().then(setVehicles).catch(console.error);
  }, []);

  const handleSearch = async () => {
    if (search.length < 2) return;
    const results = await api.searchVehicles(search);
    setVehicles(results);
  };

  return (
    <div className="flex gap-6">
      <div className="w-80">
        <div className="flex gap-2 mb-4">
          <input placeholder="Search plate/description..." value={search}
            onChange={(e) => setSearch(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1 bg-trace-bg border border-trace-border rounded-lg px-3 py-2 text-sm"
          />
          <button onClick={handleSearch}
            className="bg-trace-accent text-trace-bg px-3 rounded-lg text-sm font-semibold">
            Go
          </button>
        </div>
        <div className="space-y-2 max-h-[calc(100vh-8rem)] overflow-auto">
          {vehicles.map((v) => (
            <button key={v.id} onClick={() => setSelected(v)}
              className={`w-full text-left p-3 rounded-lg border transition ${
                selected?.id === v.id
                  ? "border-trace-accent bg-trace-surface"
                  : "border-trace-border bg-trace-bg hover:bg-trace-surface"
              }`}
            >
              <div className="font-mono font-bold tracking-wider">{v.plate || "No plate"}</div>
              <div className="text-xs text-gray-500 mt-1">
                {[v.color, v.year, v.make, v.model].filter(Boolean).join(" ")}
              </div>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div className="flex-1 bg-trace-surface rounded-lg p-6 border border-trace-border">
          <h2 className="text-2xl font-mono font-bold tracking-widest mb-4">
            {selected.plate || "No plate"}
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Field label="Make" value={selected.make} />
            <Field label="Model" value={selected.model} />
            <Field label="Year" value={selected.year} />
            <Field label="Color" value={selected.color} />
            <Field label="Status" value={selected.status} />
            <Field label="Last Seen" value={selected.lastSeenAt ? new Date(selected.lastSeenAt).toLocaleDateString() : "—"} />
          </div>
          {selected.description && (
            <div className="mt-4">
              <label className="text-xs text-gray-500 uppercase tracking-wider">Description</label>
              <p className="mt-1 text-gray-300">{selected.description}</p>
            </div>
          )}
          {selected.notes && (
            <div className="mt-4">
              <label className="text-xs text-gray-500 uppercase tracking-wider">Notes</label>
              <p className="mt-1 text-gray-300">{selected.notes}</p>
            </div>
          )}
          {/* TODO: sighting timeline, linked actors, map, suspicion history */}
          <VehicleMap vehicleId={selected.id} />
        </div>
      )}
    </div>
  );
}

function Field(props: { label: string; value: any }) {
  return (
    <div>
      <label className="text-xs text-gray-500 uppercase tracking-wider">{props.label}</label>
      <p className="mt-1">{props.value || "—"}</p>
    </div>
  );
}

function VehicleMap({ vehicleId }: { vehicleId: string }) {
  const [corridorData, setCorridorData] = useState<any[]>([]);
  const [sightingMarkers, setSightingMarkers] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("trace_op_token");
    const headers: any = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    // load corridor
    fetch(`${API_BASE}/geo/corridor/${vehicleId}`, { headers })
      .then((r) => r.json())
      .then((segments) => setCorridorData(segments))
      .catch(() => {});

    // load sightings for markers
    fetch(`${API_BASE}/sightings?vehicleId=${vehicleId}`, { headers })
      .then((r) => r.json())
      .then((sightings: any[]) => {
        setSightingMarkers(
          sightings
            .filter((s) => s.lat)
            .map((s) => ({
              lat: s.lat,
              lng: s.lng,
              color: "#4fc3f7",
              popup: `${new Date(s.observedAt).toLocaleDateString()} - ${s.activityDescription || "sighting"}`,
            }))
        );
      })
      .catch(() => {});
  }, [vehicleId]);

  if (sightingMarkers.length === 0) return null;

  return (
    <div className="mt-6">
      <label className="text-xs text-gray-500 uppercase tracking-wider">Sighting Locations</label>
      <div className="mt-2">
        <IntelMap
          markers={sightingMarkers}
          corridors={corridorData.length > 0 ? [{ vehicleId, color: "#e74c3c", segments: corridorData }] : []}
          height="300px"
        />
      </div>
    </div>
  );
}
