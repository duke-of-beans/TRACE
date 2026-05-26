/**
 * TRACE Operator — Intelligence Map Page
 *
 * Full geospatial view with heatmap, corridors,
 * co-occurrence zones, time slider, and filter controls.
 * Date range, vehicle, and temporal filtering.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { api } from "../lib/api.js";
import { IntelMap } from "../components/map-view.js";
import { TimeSlider } from "../components/time-slider.js";

type HeatmapPoint = { lat: number; lng: number; weight: number };
type Corridor = { vehicleId: string; color: string; segments: any[] };
type CoOccurrence = { vehicleA: string; vehicleB: string; lat: number; lng: number; count: number };
type TemporalBucket = { startTime: string; endTime: string; points: any[] };

const CORRIDOR_COLORS = ["#e74c3c", "#3498db", "#2ecc71", "#9b59b6", "#f39c12", "#1abc9c"];

type RangePreset = "24h" | "7d" | "30d" | "90d" | "all" | "custom";

function presetToRange(preset: RangePreset): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString();
  switch (preset) {
    case "24h": return { start: new Date(now.getTime() - 86400000).toISOString(), end };
    case "7d": return { start: new Date(now.getTime() - 7 * 86400000).toISOString(), end };
    case "30d": return { start: new Date(now.getTime() - 30 * 86400000).toISOString(), end };
    case "90d": return { start: new Date(now.getTime() - 90 * 86400000).toISOString(), end };
    case "all": return { start: new Date(0).toISOString(), end };
    default: return { start: new Date(now.getTime() - 7 * 86400000).toISOString(), end };
  }
}

export function Intelligence() {
  // --- Filter state ---
  const [rangePreset, setRangePreset] = useState<RangePreset>("7d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [vehicles, setVehicles] = useState<any[]>([]);

  // --- Geo data state ---
  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([]);
  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [coOccurrences, setCoOccurrences] = useState<CoOccurrence[]>([]);
  const [temporalBuckets, setTemporalBuckets] = useState<TemporalBucket[]>([]);
  const [sliderIndex, setSliderIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [corridorVehicleId, setCorridorVehicleId] = useState("");
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // load vehicle list for filter dropdown
  useEffect(() => {
    api.getVehicles().then((v) => setVehicles(Array.isArray(v) ? v : [])).catch(() => {});
  }, []);

  // compute active date range
  const getActiveRange = useCallback(() => {
    if (rangePreset === "custom" && customStart && customEnd) {
      return {
        start: new Date(customStart).toISOString(),
        end: new Date(customEnd + "T23:59:59").toISOString(),
      };
    }
    return presetToRange(rangePreset);
  }, [rangePreset, customStart, customEnd]);

  // --- Load geo data with current filters ---
  const loadData = useCallback(async () => {
    setLoading(true);
    setSliderIndex(0);
    setPlaying(false);
    if (playRef.current) { clearInterval(playRef.current); playRef.current = null; }

    const { start, end } = getActiveRange();
    const vParam = vehicleFilter ? `&vehicleId=${vehicleFilter}` : "";
    const base = getApiBase();
    const headers = authHeaders();

    try {
      const [heatData, coData, tempData] = await Promise.all([
        fetch(`${base}/geo/heatmap?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}${vParam}`, headers).then((r) => r.ok ? r.json() : []),
        fetch(`${base}/geo/co-occurrence?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}${vParam}`, headers).then((r) => r.ok ? r.json() : []),
        fetch(`${base}/geo/temporal?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&bucket=60${vParam}`, headers).then((r) => r.ok ? r.json() : []),
      ]);
      setHeatmap(Array.isArray(heatData) ? heatData : []);
      setCoOccurrences(Array.isArray(coData) ? coData : []);
      setTemporalBuckets(Array.isArray(tempData) ? tempData : []);
    } catch (err) {
      console.error("Failed to load geo data:", err);
    }
    setLoading(false);
  }, [getActiveRange, vehicleFilter]);

  // initial load
  useEffect(() => { loadData(); }, []);

  // load corridor for a specific vehicle
  const loadCorridor = useCallback(async (vehicleId: string) => {
    if (!vehicleId) return;
    try {
      const segments = await fetch(
        `${getApiBase()}/geo/corridor/${vehicleId}`, authHeaders()
      ).then((r) => r.json());
      const colorIdx = corridors.length % CORRIDOR_COLORS.length;
      setCorridors((prev) => [
        ...prev,
        { vehicleId, color: CORRIDOR_COLORS[colorIdx], segments },
      ]);
    } catch (err) {
      console.error("Failed to load corridor:", err);
    }
  }, [corridors.length]);

  // time slider playback
  const togglePlay = useCallback(() => {
    if (playing) {
      if (playRef.current) clearInterval(playRef.current);
      playRef.current = null;
      setPlaying(false);
    } else {
      setPlaying(true);
      playRef.current = setInterval(() => {
        setSliderIndex((i) => {
          if (i >= temporalBuckets.length - 1) {
            if (playRef.current) clearInterval(playRef.current);
            setPlaying(false);
            return i;
          }
          return i + 1;
        });
      }, 800);
    }
  }, [playing, temporalBuckets.length]);

  // temporal markers for current slider position
  const temporalMarkers = useMemo(() => {
    return (temporalBuckets[sliderIndex]?.points || []).map((p: any) => ({
      lat: p.lat, lng: p.lng,
      color: "#f1c40f",
      popup: `Vehicle: ${p.vehicleId?.slice(0, 8) || "unknown"}`,
      label: p.vehicleId?.slice(0, 8) || "",
    }));
  }, [temporalBuckets, sliderIndex]);

  // total sightings across all buckets
  const totalSightings = useMemo(() => {
    return temporalBuckets.reduce((sum, b) => sum + b.points.length, 0);
  }, [temporalBuckets]);

  if (loading && heatmap.length === 0) {
    return <div className="text-sm" style={{ color: "var(--text-muted)" }}>Loading intelligence data...</div>;
  }

  const presets: { key: RangePreset; label: string }[] = [
    { key: "24h", label: "24h" },
    { key: "7d", label: "7d" },
    { key: "30d", label: "30d" },
    { key: "90d", label: "90d" },
    { key: "all", label: "All" },
    { key: "custom", label: "Custom" },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
        <h1 className="text-2xl font-bold">Intelligence Map</h1>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 rounded bg-trace-surface" style={{ color: "var(--text-muted)" }}>
            {totalSightings} sightings
          </span>
          <span className="px-2 py-1 rounded bg-trace-surface" style={{ color: "var(--text-muted)" }}>
            {heatmap.length} heat zones
          </span>
          <span className="px-2 py-1 rounded bg-trace-surface" style={{ color: "var(--text-muted)" }}>
            {coOccurrences.length} co-occurrences
          </span>
          <span className="px-2 py-1 rounded bg-trace-surface" style={{ color: "var(--text-muted)" }}>
            {corridors.length} corridors
          </span>
        </div>
      </div>

      {/* Filter controls */}
      <div className="bg-trace-surface rounded-lg p-4 border border-trace-border mb-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* Date range presets */}
          <div>
            <label className="text-xs uppercase tracking-wider block mb-1.5" style={{ color: "var(--text-muted)" }}>
              Date Range
            </label>
            <div className="flex gap-1">
              {presets.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setRangePreset(p.key)}
                  className="px-2.5 py-1.5 rounded text-xs font-medium transition-colors"
                  style={{
                    background: rangePreset === p.key ? "var(--accent)" : "var(--bg)",
                    color: rangePreset === p.key ? "var(--accent-text)" : "var(--text-sec)",
                    border: `1px solid ${rangePreset === p.key ? "var(--accent)" : "var(--border)"}`,
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom date inputs */}
          {rangePreset === "custom" && (
            <div className="flex gap-2 items-end">
              <div>
                <label className="text-xs uppercase tracking-wider block mb-1.5" style={{ color: "var(--text-muted)" }}>From</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="bg-trace-bg border border-trace-border rounded px-2 py-1.5 text-xs"
                  style={{ colorScheme: "dark" }}
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider block mb-1.5" style={{ color: "var(--text-muted)" }}>To</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="bg-trace-bg border border-trace-border rounded px-2 py-1.5 text-xs"
                  style={{ colorScheme: "dark" }}
                />
              </div>
            </div>
          )}

          {/* Vehicle filter */}
          <div>
            <label className="text-xs uppercase tracking-wider block mb-1.5" style={{ color: "var(--text-muted)" }}>
              Vehicle
            </label>
            <select
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
              className="bg-trace-bg border border-trace-border rounded px-2 py-1.5 text-xs min-w-[160px]"
              style={{ colorScheme: "dark" }}
            >
              <option value="">All vehicles</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate || v.id.slice(0, 8)} {v.make ? `(${v.color || ""} ${v.make} ${v.model || ""})`.trim() : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Apply */}
          <button
            onClick={loadData}
            disabled={loading}
            className="px-4 py-1.5 rounded text-xs font-semibold transition-opacity"
            style={{ background: "var(--accent)", color: "var(--accent-text)", opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Loading..." : "Apply"}
          </button>
        </div>
      </div>

      {/* Corridor overlay */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <label className="text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--text-muted)" }}>
            Movement Corridors
          </label>
        </div>
        <p className="text-xs mb-2" style={{ color: "var(--text-sec)" }}>
          Select a vehicle to draw its movement path on the map. Each line connects sighting locations in chronological order. Multiple corridors can be overlaid to compare routes.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={corridorVehicleId}
          onChange={(e) => setCorridorVehicleId(e.target.value)}
          className="flex-1 bg-trace-bg border border-trace-border rounded-lg px-3 py-2 text-sm"
          style={{ colorScheme: "dark" }}
        >
          <option value="">Select vehicle for corridor overlay...</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.plate || v.id.slice(0, 8)} {v.make ? `(${v.color || ""} ${v.make} ${v.model || ""})`.trim() : ""}
            </option>
          ))}
        </select>
        <button
          onClick={() => { if (corridorVehicleId) { loadCorridor(corridorVehicleId); setCorridorVehicleId(""); } }}
          className="px-4 rounded-lg text-sm font-semibold"
          style={{ background: "var(--accent)", color: "var(--accent-text)" }}
        >
          Add Corridor
        </button>
        {corridors.length > 0 && (
          <button
            onClick={() => setCorridors([])}
            className="px-4 rounded-lg text-sm"
            style={{ background: "var(--surface-alt, var(--bg))", color: "var(--text-muted)" }}
          >
            Clear
          </button>
        )}
        </div>
      </div>

      {/* Map */}
      <IntelMap
        markers={temporalMarkers}
        heatmapData={heatmap}
        corridors={corridors}
        coOccurrences={coOccurrences}
        height="calc(100vh - 380px)"
      />

      {/* Time Playback */}
      {temporalBuckets.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <label className="text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--text-muted)" }}>
              Time Playback
            </label>
          </div>
          <p className="text-xs mb-2" style={{ color: "var(--text-sec)" }}>
            Sightings grouped into 1-hour windows. Drag the slider or press play to step through each window. The map shows only the sightings that occurred during the selected hour.
          </p>
          <TimeSlider
            buckets={temporalBuckets.map((b) => ({
              startTime: b.startTime,
              endTime: b.endTime,
              pointCount: b.points.length,
            }))}
            selectedIndex={sliderIndex}
            onChange={setSliderIndex}
            playing={playing}
            onTogglePlay={togglePlay}
          />
        </div>
      )}

      {temporalBuckets.length === 0 && !loading && (
        <div className="mt-4 text-center py-6 text-sm" style={{ color: "var(--text-muted)" }}>
          No sighting data in this range.{vehicleFilter ? " Try removing the vehicle filter." : " Try expanding the date range."}
        </div>
      )}
    </div>
  );
}

// helpers
function getApiBase() {
  return import.meta.env.VITE_API_URL || "/api/v1";
}

function authHeaders(): RequestInit {
  const token = localStorage.getItem("trace_op_token");
  return {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
}
