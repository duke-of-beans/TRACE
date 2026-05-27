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
import type { MapMarker } from "../components/map-view.js";
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

  // --- Dispatch state ---
  const [dispatchPins, setDispatchPins] = useState<any[]>([]);
  const [rawDispatches, setRawDispatches] = useState<any[]>([]);
  const [placingPin, setPlacingPin] = useState<{ lat: number; lng: number } | null>(null);
  const [reporters, setReporters] = useState<any[]>([]);
  const [eventTypes, setEventTypes] = useState<any[]>([]);
  const [selectedPin, setSelectedPin] = useState<any>(null);
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [temporalBuckets, setTemporalBuckets] = useState<TemporalBucket[]>([]);
  const [sliderIndex, setSliderIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [corridorVehicleId, setCorridorVehicleId] = useState("");
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // load vehicle list for filter dropdown
  useEffect(() => {
    api.getVehicles().then((v) => setVehicles(Array.isArray(v) ? v : [])).catch(() => {});
    api.getDispatchEventTypes().then(setEventTypes).catch(() => {});
    api.getReporters().then(setReporters).catch(() => {});
    loadDispatchPins();
  }, []);

  const loadDispatchPins = async () => {
    try {
      const all = await api.getDispatches();
      setRawDispatches(Array.isArray(all) ? all : []);
    } catch {}
  };

  // Enrich dispatches when either raw data or event types change
  useEffect(() => {
    const enriched = rawDispatches.map((d: any) => {
      const et = eventTypes.find((t: any) => t.id === d.eventTypeId);
      return {
        ...d,
        eventTypeLabel: et?.label,
        eventTypeIcon: et?.icon,
        eventTypeColor: et?.color,
      };
    });
    setDispatchPins(enriched);
  }, [rawDispatches, eventTypes]);

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
    return (temporalBuckets[sliderIndex]?.points || []).map((p: any) => {
      const timeStr = p.observedAt ? new Date(p.observedAt).toLocaleTimeString() : "";
      return {
        lat: p.lat, lng: p.lng,
        color: "#f1c40f",
        label: p.plate || "",
        data: {
          plate: p.plate,
          activityDescription: p.activityDescription,
          observedAt: p.observedAt,
          direction: p.direction,
          vehicleId: p.vehicleId,
          sightingId: p.id,
        },
      };
    });
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
    <div style={{
      position: "relative",
      height: "calc(100vh - 56px)",
      margin: "-16px -16px -16px -16px",
      overflow: "hidden",
    }}>
      {/* FULL-BLEED MAP */}
      <IntelMap
        markers={temporalMarkers}
        heatmapData={heatmap}
        corridors={corridors}
        coOccurrences={coOccurrences}
        dispatchPins={dispatchPins}
        onPlacePin={(lat, lng) => { setPlacingPin({ lat, lng }); setSelectedPin(null); setSelectedMarker(null); }}
        onPinClick={(pin) => { setSelectedPin(pin); setPlacingPin(null); setSelectedMarker(null); }}
        onMarkerClick={(marker) => { setSelectedMarker(marker); setSelectedPin(null); setPlacingPin(null); }}
        height="100%"
      >
        {/* ── FLOATING FILTER BAR (responsive) ── */}
        <div style={{
          position: "absolute", top: 12, left: 50, right: 12, zIndex: 1000,
          background: "rgba(15,23,42,0.85)", backdropFilter: "blur(8px)",
          border: "1px solid var(--border)", borderRadius: 10,
          padding: "6px 10px", display: "flex", alignItems: "center", gap: 6,
          flexWrap: "wrap", maxWidth: "calc(100% - 62px)",
        }}>
          {presets.map((p) => (
            <button key={p.key} onClick={() => { setRangePreset(p.key); }}
              style={{
                padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
                background: rangePreset === p.key ? "var(--accent)" : "transparent",
                color: rangePreset === p.key ? "var(--accent-text)" : "var(--text-muted)",
                border: rangePreset === p.key ? "1px solid var(--accent)" : "1px solid transparent",
                whiteSpace: "nowrap",
              }}>
              {p.label}
            </button>
          ))}
          <select value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)}
            style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 6px", fontSize: 11, color: "var(--text-sec)", minWidth: 90, maxWidth: 140, colorScheme: "dark" }}>
            <option value="">All vehicles</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>{v.plate || v.id.slice(0, 8)}</option>
            ))}
          </select>
          <button onClick={loadData} disabled={loading}
            style={{ padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: "var(--accent)", color: "var(--accent-text)", border: "none", cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
            {loading ? "..." : "Apply"}
          </button>
        </div>

        {/* ── FLOATING ACTION BUTTONS (left side, below zoom) ── */}
        <div style={{
          position: "absolute", top: 90, left: 12, zIndex: 1000,
          display: "flex", flexDirection: "column", gap: 6,
        }}>
          <button onClick={() => {
            const mapEl = document.querySelector(".leaflet-container") as any;
            const center = mapEl?._leaflet_map?.getCenter?.() || { lat: 38.9310, lng: -77.1770 };
            setPlacingPin({ lat: center.lat, lng: center.lng }); setSelectedPin(null); setSelectedMarker(null);
          }} style={{
            background: "var(--accent)", color: "var(--accent-text)", border: "none", borderRadius: 8,
            padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)", display: "flex", alignItems: "center", gap: 4,
          }}>+ Pin</button>
          {corridors.length > 0 && (
            <button onClick={() => setCorridors([])} style={{
              background: "rgba(15,23,42,0.85)", color: "var(--text-sec)", border: "1px solid var(--border)", borderRadius: 8,
              padding: "6px 12px", fontSize: 11, cursor: "pointer", backdropFilter: "blur(8px)",
            }}>Clear corridors</button>
          )}
        </div>

        {/* ── STATS BADGES (bottom-right) ── */}
        <div style={{
          position: "absolute", bottom: temporalBuckets.length > 0 ? 56 : 12, right: 12, zIndex: 1000,
          display: "flex", gap: 6,
        }}>
          <span style={{
            padding: "4px 10px", borderRadius: 20, fontSize: 10, fontWeight: 600,
            background: "rgba(15,23,42,0.85)", color: "var(--text-muted)", border: "1px solid var(--border)",
            backdropFilter: "blur(8px)",
          }}>{totalSightings} sightings</span>
          <span style={{
            padding: "4px 10px", borderRadius: 20, fontSize: 10, fontWeight: 600,
            background: "rgba(15,23,42,0.85)", color: "var(--text-muted)", border: "1px solid var(--border)",
            backdropFilter: "blur(8px)",
          }}>{corridors.length} corridors</span>
        </div>

        {/* ── BOTTOM TIME SCRUBBER (floating on map) ── */}
        {temporalBuckets.length > 0 && (
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 1000,
            background: "rgba(15,23,42,0.9)", backdropFilter: "blur(8px)",
            borderTop: "1px solid var(--border)", padding: "6px 16px",
          }}>
            <TimeSlider
              buckets={temporalBuckets.map((b) => ({ startTime: b.startTime, endTime: b.endTime, pointCount: b.points.length }))}
              selectedIndex={sliderIndex}
              onChange={setSliderIndex}
              playing={playing}
              onTogglePlay={togglePlay}
            />
          </div>
        )}
      </IntelMap>

      {/* ── RIGHT-SIDE DETAIL PANELS (outside IntelMap for z-index) ── */}
      {selectedMarker && (
        <div style={{
          position: "absolute", top: 0, right: 0, bottom: 0, width: 340, zIndex: 10001,
          background: "var(--surface)", borderLeft: "1px solid var(--border)",
          padding: 20, overflowY: "auto",
          boxShadow: "-4px 0 20px rgba(0,0,0,0.3)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, fontWeight: 700, background: "#f1c40f", color: "#000" }}>Sighting</span>
            <button onClick={() => setSelectedMarker(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>
          {selectedMarker.data?.plate && (
            <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: "0.1em", fontSize: 18, marginBottom: 8 }}>{selectedMarker.data.plate}</div>
          )}
          {selectedMarker.data?.activityDescription && <p style={{ fontSize: 13, color: "var(--text-sec)", marginBottom: 8, lineHeight: 1.5 }}>{selectedMarker.data.activityDescription}</p>}
          {selectedMarker.data?.vehicleDescription && <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>{selectedMarker.data.vehicleDescription}</p>}
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 16, display: "flex", flexDirection: "column", gap: 4 }}>
            {selectedMarker.data?.observedAt && <span>{new Date(selectedMarker.data.observedAt).toLocaleString()}</span>}
            {selectedMarker.data?.direction && <span>Heading {selectedMarker.data.direction}</span>}
            <span>{selectedMarker.lat.toFixed(5)}, {selectedMarker.lng.toFixed(5)}</span>
          </div>
          <button onClick={() => { setPlacingPin({ lat: selectedMarker.lat, lng: selectedMarker.lng }); setSelectedMarker(null); }}
            style={{ width: "100%", background: "var(--accent)", color: "var(--accent-text)", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Dispatch here
          </button>
        </div>
      )}

      {selectedPin && (
        <div style={{
          position: "absolute", top: 0, right: 0, bottom: 0, width: 340, zIndex: 10001,
          background: "var(--surface)", borderLeft: "1px solid var(--border)",
          padding: 20, overflowY: "auto",
          boxShadow: "-4px 0 20px rgba(0,0,0,0.3)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, fontWeight: 700, background: selectedPin.priority === "urgent" ? "#DC2626" : "#D97706", color: "#fff" }}>{selectedPin.priority}</span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{selectedPin.eventTypeLabel || "Dispatch"}</span>
            </div>
            <button onClick={() => setSelectedPin(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>
          {selectedPin.plate && <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: "0.1em", fontSize: 16, marginBottom: 8 }}>{selectedPin.plate}</div>}
          {selectedPin.notes && <p style={{ fontSize: 13, color: "var(--text-sec)", marginBottom: 8, lineHeight: 1.5 }}>{selectedPin.notes}</p>}
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 16 }}>
            {(() => { const m = Math.round((Date.now() - new Date(selectedPin.createdAt).getTime()) / 60000); return m < 60 ? `${m}m ago` : `${Math.round(m/60)}h ago`; })()} - {selectedPin.status}
          </div>
          {selectedPin.status !== "closed" && selectedPin.status !== "expired" && (
            <button onClick={async () => { await api.closeDispatch(selectedPin.id, "operator_closed").catch(() => {}); setSelectedPin(null); loadDispatchPins(); }}
              style={{ width: "100%", background: "var(--surface-alt)", color: "var(--text-sec)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 16px", fontSize: 13, cursor: "pointer" }}>
              Close Dispatch
            </button>
          )}
        </div>
      )}

      {/* Pin creation form (modal overlay) */}
      {placingPin && (
        <div style={{
          position: "absolute", top: 0, right: 0, bottom: 0, width: 380, zIndex: 10001,
          background: "var(--surface)", borderLeft: "1px solid var(--border)",
          padding: 20, overflowY: "auto",
          boxShadow: "-4px 0 20px rgba(0,0,0,0.3)",
        }}>
          <PinCreationForm
            lat={placingPin.lat}
            lng={placingPin.lng}
            eventTypes={eventTypes}
            reporters={reporters}
            onSave={async (data) => {
              try {
                await api.createDispatch({ ...data, lat: placingPin.lat, lng: placingPin.lng });
                setPlacingPin(null);
                loadDispatchPins();
              } catch {}
            }}
            onCancel={() => { setPlacingPin(null); setDispatchPins(p => [...p]); }}
          />
        </div>
      )}

      {/* No data message */}
      {temporalBuckets.length === 0 && !loading && (
        <div style={{
          position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", zIndex: 1000,
          background: "rgba(15,23,42,0.85)", backdropFilter: "blur(8px)", border: "1px solid var(--border)",
          borderRadius: 8, padding: "8px 20px", fontSize: 12, color: "var(--text-muted)",
        }}>
          No sighting data in this range.{vehicleFilter ? " Remove the vehicle filter." : " Expand the date range."}
        </div>
      )}
    </div>
  );
}


// --- Pin Creation Form ---
function PinCreationForm({ lat, lng, eventTypes, reporters, onSave, onCancel }: {
  lat: number; lng: number; eventTypes: any[]; reporters: any[];
  onSave: (data: any) => void; onCancel: () => void;
}) {
  const [eventTypeId, setEventTypeId] = useState(eventTypes[0]?.id || "");
  const [priority, setPriority] = useState("routine");
  const [plate, setPlate] = useState("");
  const [notes, setNotes] = useState("");
  const [source, setSource] = useState("community_call");
  const [selectedReporters, setSelectedReporters] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  return (
    <div className="mt-4 bg-trace-surface rounded-lg p-5 border border-trace-border">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold">Pin dropped - add details</h3>
        <button onClick={onCancel} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>✕</button>
      </div>
      <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
        All fields are optional. Save with no details for a bare pin, or add context and dispatch patrollers.
      </p>

      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* Event type */}
        {eventTypes.length > 0 && (
          <select value={eventTypeId} onChange={(e) => setEventTypeId(e.target.value)}
            className="bg-trace-bg border border-trace-border rounded-lg px-3 py-2 text-sm" style={{ colorScheme: "dark" }}>
            {eventTypes.map((t: any) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        )}
        {eventTypes.length === 0 && (
          <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>No event types configured.</p>
        )}

        {/* Source */}
        <select value={source} onChange={(e) => setSource(e.target.value)}
          className="bg-trace-bg border border-trace-border rounded-lg px-3 py-2 text-sm" style={{ colorScheme: "dark" }}>
          <option value="community_call">Community call</option>
          <option value="operator">Operator decision</option>
          <option value="intelligence">Intelligence</option>
        </select>
      </div>
      <p className="text-[10px] mb-3" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
        Customize event types, icons, and colors in <a href="#" onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent("trace-nav", { detail: "admin" })); }} style={{ color: "var(--accent)", textDecoration: "underline" }}>Admin → Dispatch Types</a>
      </p>

      {/* Priority */}
      <div className="flex gap-2 mb-3">
        {[
          { key: "urgent", label: "Urgent", color: "#DC2626" },
          { key: "routine", label: "Routine", color: "#D97706" },
          { key: "info", label: "Info", color: "#64748B" },
        ].map((p) => (
          <button key={p.key} onClick={() => setPriority(p.key)}
            className="flex-1 py-1.5 rounded text-xs font-medium transition"
            style={{
              background: priority === p.key ? p.color : "var(--bg)",
              color: priority === p.key ? "#fff" : "var(--text-sec)",
              border: `1px solid ${priority === p.key ? p.color : "var(--border)"}`,
            }}>{p.label}</button>
        ))}
      </div>

      {/* Plate + Notes on one row */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <input placeholder="Plate (optional)" value={plate}
          onChange={(e) => setPlate(e.target.value.toUpperCase())}
          className="bg-trace-bg border border-trace-border rounded-lg px-3 py-2 text-sm font-mono" />
        <input placeholder="Notes (optional)" value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="bg-trace-bg border border-trace-border rounded-lg px-3 py-2 text-sm" />
      </div>

      {/* Reporter selection */}
      {reporters.length > 0 && (
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Dispatch to (optional)</span>
            <button onClick={() => setSelectedReporters(reporters.map((r: any) => r.id))}
              className="text-xs" style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>All</button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {reporters.map((r: any) => (
              <button key={r.id}
                onClick={() => setSelectedReporters((prev) => prev.includes(r.id) ? prev.filter((x) => x !== r.id) : [...prev, r.id])}
                className="px-2.5 py-1 rounded text-xs transition"
                style={{
                  background: selectedReporters.includes(r.id) ? "var(--accent)" : "var(--bg)",
                  color: selectedReporters.includes(r.id) ? "#fff" : "var(--text-sec)",
                  border: `1px solid ${selectedReporters.includes(r.id) ? "var(--accent)" : "var(--border)"}`,
                }}>{r.callsign || r.id.slice(0, 8)}</button>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={async () => {
          setSending(true);
          await onSave({
            eventTypeId: eventTypeId || undefined,
            priority, plate: plate || undefined,
            notes: notes || undefined,
            source,
            reporterIds: selectedReporters.length > 0 ? selectedReporters : undefined,
          });
          setSending(false);
        }} disabled={sending}
          className="flex-1 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50"
          style={{ background: selectedReporters.length > 0 ? (priority === "urgent" ? "#DC2626" : "var(--accent)") : "var(--surface-alt, var(--bg))", color: selectedReporters.length > 0 ? "#fff" : "var(--text)", border: "1px solid var(--border)" }}>
          {sending ? "Saving..." : selectedReporters.length > 0 ? `Dispatch ${selectedReporters.length} patroller${selectedReporters.length !== 1 ? "s" : ""}` : "Save Pin"}
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm"
          style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-sec)" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// --- Pin Detail Panel ---
function PinDetailPanel({ pin, reporters, onClose, onDispatch, onCloseDispatch }: {
  pin: any; reporters: any[]; onClose: () => void;
  onDispatch: (reporterIds: string[]) => void; onCloseDispatch: () => void;
}) {
  const [selectedReporters, setSelectedReporters] = useState<string[]>([]);
  const timeAgo = (() => {
    const mins = Math.round((Date.now() - new Date(pin.createdAt).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    return `${Math.round(mins / 60)}h ago`;
  })();

  return (
    <div data-trace-panel className="mt-4 bg-trace-surface rounded-lg p-5 border border-trace-border">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded font-semibold"
            style={{ background: pin.priority === "urgent" ? "#DC2626" : pin.priority === "routine" ? "#D97706" : "#64748B", color: "#fff" }}>
            {pin.priority}
          </span>
          <span className="text-sm font-semibold">{pin.eventTypeLabel || "Dispatch"}</span>
        </div>
        <button onClick={onClose} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>✕</button>
      </div>

      {pin.plate && <div className="font-mono font-bold tracking-wider mb-1">{pin.plate}</div>}
      {pin.notes && <p className="text-sm mb-2" style={{ color: "var(--text-sec)" }}>{pin.notes}</p>}
      <div className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>{timeAgo} · {pin.status}</div>

      {pin.status !== "closed" && pin.status !== "expired" && (
        <>
          {reporters.length > 0 && (
            <div className="mb-3">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>Add patrollers:</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {reporters.map((r: any) => (
                  <button key={r.id}
                    onClick={() => setSelectedReporters((prev) => prev.includes(r.id) ? prev.filter((x) => x !== r.id) : [...prev, r.id])}
                    className="px-2.5 py-1 rounded text-xs transition"
                    style={{
                      background: selectedReporters.includes(r.id) ? "var(--accent)" : "var(--bg)",
                      color: selectedReporters.includes(r.id) ? "#fff" : "var(--text-sec)",
                      border: `1px solid ${selectedReporters.includes(r.id) ? "var(--accent)" : "var(--border)"}`,
                    }}>{r.callsign || r.id.slice(0, 8)}</button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            {selectedReporters.length > 0 && (
              <button onClick={() => { onDispatch(selectedReporters); setSelectedReporters([]); }}
                className="flex-1 py-2 rounded-lg text-sm font-semibold"
                style={{ background: "var(--accent)", color: "var(--accent-text)" }}>
                Dispatch {selectedReporters.length}
              </button>
            )}
            <button onClick={onCloseDispatch}
              className="px-4 py-2 rounded-lg text-sm"
              style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
              Close Pin
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// --- Sighting Detail Panel ---
function SightingDetailPanel({ marker, onClose, onCreateDispatch }: {
  marker: MapMarker; onClose: () => void;
  onCreateDispatch: (lat: number, lng: number) => void;
}) {
  const d = marker.data || {};
  const timeStr = d.observedAt ? new Date(d.observedAt).toLocaleString() : "";
  const timeAgo = (() => {
    if (!d.observedAt) return "";
    const mins = Math.round((Date.now() - new Date(d.observedAt).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
    return `${Math.round(mins / 1440)}d ago`;
  })();

  return (
    <div data-trace-panel className="mt-4 bg-trace-surface rounded-lg p-5 border border-trace-border">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded font-semibold"
            style={{ background: "#f1c40f", color: "#000" }}>
            Sighting
          </span>
          {d.plate && (
            <span className="font-mono font-bold tracking-wider text-sm">{d.plate}</span>
          )}
        </div>
        <button onClick={onClose} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>✕</button>
      </div>

      {d.activityDescription && (
        <p className="text-sm mb-2" style={{ color: "var(--text-sec)" }}>{d.activityDescription}</p>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-3" style={{ color: "var(--text-muted)" }}>
        {timeStr && (
          <div><span style={{ color: "var(--text-sec)" }}>Observed:</span> {timeStr} ({timeAgo})</div>
        )}
        {d.direction && (
          <div><span style={{ color: "var(--text-sec)" }}>Heading:</span> {d.direction}</div>
        )}
        <div><span style={{ color: "var(--text-sec)" }}>Location:</span> {marker.lat.toFixed(5)}, {marker.lng.toFixed(5)}</div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onCreateDispatch(marker.lat, marker.lng)}
          className="px-4 py-2 rounded-lg text-xs font-semibold"
          style={{ background: "var(--accent)", color: "var(--accent-text)" }}>
          Create dispatch here
        </button>
        <button onClick={onClose}
          className="px-4 py-2 rounded-lg text-xs"
          style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-sec)" }}>
          Close
        </button>
      </div>
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
