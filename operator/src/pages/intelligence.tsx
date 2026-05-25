/**
 * TRACE Operator — Intelligence Map Page
 *
 * Full geospatial view with heatmap, corridors,
 * co-occurrence zones, and time slider.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../lib/api.js";
import { IntelMap } from "../components/map-view.js";
import { TimeSlider } from "../components/time-slider.js";

type HeatmapPoint = { lat: number; lng: number; weight: number };
type Corridor = { vehicleId: string; color: string; segments: any[] };
type CoOccurrence = { vehicleA: string; vehicleB: string; lat: number; lng: number; count: number };
type TemporalBucket = { startTime: string; endTime: string; points: any[] };

const CORRIDOR_COLORS = ["#e74c3c", "#3498db", "#2ecc71", "#9b59b6", "#f39c12", "#1abc9c"];

export function Intelligence() {
  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([]);
  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [coOccurrences, setCoOccurrences] = useState<CoOccurrence[]>([]);
  const [temporalBuckets, setTemporalBuckets] = useState<TemporalBucket[]>([]);
  const [sliderIndex, setSliderIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [corridorVehicleId, setCorridorVehicleId] = useState("");
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // load geo data
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [heatData, coData, tempData] = await Promise.all([
          fetch(`${getApiBase()}/geo/heatmap`, authHeaders()).then((r) => r.ok ? r.json() : []),
          fetch(`${getApiBase()}/geo/co-occurrence`, authHeaders()).then((r) => r.ok ? r.json() : []),
          fetch(`${getApiBase()}/geo/temporal?bucket=60`, authHeaders()).then((r) => r.ok ? r.json() : []),
        ]);
        setHeatmap(Array.isArray(heatData) ? heatData : []);
        setCoOccurrences(Array.isArray(coData) ? coData : []);
        setTemporalBuckets(Array.isArray(tempData) ? tempData : []);
      } catch (err) {
        console.error("Failed to load geo data:", err);
      }
      setLoading(false);
    };
    load();
  }, []);

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
  const temporalMarkers = (temporalBuckets[sliderIndex]?.points || []).map((p: any) => ({
    lat: p.lat, lng: p.lng,
    color: "#f1c40f",
    popup: `Vehicle: ${p.vehicleId?.slice(0, 8) || "unknown"}`,
  }));

  if (loading) {
    return <div className="text-gray-500">Loading intelligence data...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Intelligence Map</h1>
        <div className="flex gap-2 text-xs">
          <span className="px-2 py-1 rounded bg-trace-surface text-gray-400">
            {heatmap.length} heat zones
          </span>
          <span className="px-2 py-1 rounded bg-trace-surface text-gray-400">
            {coOccurrences.length} co-occurrences
          </span>
          <span className="px-2 py-1 rounded bg-trace-surface text-gray-400">
            {corridors.length} corridors
          </span>
        </div>
      </div>

      {/* Corridor input */}
      <div className="flex gap-2 mb-4">
        <input
          placeholder="Vehicle ID for corridor..."
          value={corridorVehicleId}
          onChange={(e) => setCorridorVehicleId(e.target.value)}
          className="flex-1 bg-trace-bg border border-trace-border rounded-lg px-3 py-2 text-sm"
        />
        <button
          onClick={() => { loadCorridor(corridorVehicleId); setCorridorVehicleId(""); }}
          className="bg-trace-accent text-trace-bg px-4 rounded-lg text-sm font-semibold"
        >
          Add Corridor
        </button>
        {corridors.length > 0 && (
          <button
            onClick={() => setCorridors([])}
            className="bg-trace-surface text-gray-400 px-4 rounded-lg text-sm"
          >
            Clear
          </button>
        )}
      </div>

      {/* Map */}
      <IntelMap
        markers={temporalMarkers}
        heatmapData={heatmap}
        corridors={corridors}
        coOccurrences={coOccurrences}
        height="calc(100vh - 320px)"
      />

      {/* Time Slider */}
      <div className="mt-4">
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
    </div>
  );
}

// helpers
function getApiBase() {
  return import.meta.env.VITE_API_URL || "http://localhost:3100/api/v1";
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
