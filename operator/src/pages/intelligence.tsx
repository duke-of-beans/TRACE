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
import type { MapMarker, Watchpoint } from "../components/map-view.js";
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
  const [filterOpen, setFilterOpen] = useState(false);
  const [concernFilter, setConcernFilter] = useState("");
  const [dispatchFilter, setDispatchFilter] = useState<"all" | "active" | "resolved" | "hidden">("all");
  const [actorOnly, setActorOnly] = useState(false);
  const [concernLevels, setConcernLevels] = useState<any[]>([]);
  const [actors, setActors] = useState<any[]>([]);

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
  const [markerVehicle, setMarkerVehicle] = useState<any>(null);

  // --- Watchpoint state ---
  const [watchpointsList, setWatchpointsList] = useState<Watchpoint[]>([]);
  const [creatingWatchpoint, setCreatingWatchpoint] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedWatchpoint, setSelectedWatchpoint] = useState<Watchpoint | null>(null);
  const [watchpointActivity, setWatchpointActivity] = useState<any>(null);
  const [wpActivityLoading, setWpActivityLoading] = useState(false);

  // Fetch vehicle detail when marker is selected
  useEffect(() => {
    if (!selectedMarker?.data?.vehicleId) { setMarkerVehicle(null); return; }
    api.getVehicle(selectedMarker.data.vehicleId).then(setMarkerVehicle).catch(() => setMarkerVehicle(null));
  }, [selectedMarker?.data?.vehicleId]);
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
    api.getSuspicionLevels().then((l) => setConcernLevels(Array.isArray(l) ? l : [])).catch(() => {});
    api.getActors().then((a) => setActors(Array.isArray(a) ? a : [])).catch(() => {});
    loadDispatchPins();
    loadWatchpoints();
    loadVehicleGroups();
  }, []);

  const [vehicleGroups, setVehicleGroups] = useState<any[]>([]);
  const loadVehicleGroups = async () => {
    try {
      const data = await api.getVehicleGroups();
      setVehicleGroups(Array.isArray(data) ? data : []);
    } catch {}
  };

  const loadWatchpoints = async () => {
    try {
      const data = await api.getWatchpoints();
      setWatchpointsList(Array.isArray(data?.watchpoints) ? data.watchpoints : []);
    } catch {}
  };

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

  // --- Computed filter values ---
  const actorVehicleIds = useMemo(() => new Set(actors.map((a: any) => a.vehicleId).filter(Boolean)), [actors]);
  const vehicleConcernMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const v of vehicles) { if (v.currentLevelId) map[v.id] = v.currentLevelId; }
    return map;
  }, [vehicles]);

  const activeFilterCount = [
    rangePreset !== "7d" ? 1 : 0,
    vehicleFilter ? 1 : 0,
    concernFilter ? 1 : 0,
    dispatchFilter !== "all" ? 1 : 0,
    actorOnly ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  // Filter dispatch pins by status
  const filteredDispatches = useMemo(() => {
    if (dispatchFilter === "hidden") return [];
    if (dispatchFilter === "all") return dispatchPins;
    return dispatchPins.filter((d: any) =>
      dispatchFilter === "active" ? d.status === "active" : d.status === "resolved"
    );
  }, [dispatchPins, dispatchFilter]);

  // Build set of vehicle IDs passing concern + actor filters
  const passesVehicleFilters = useCallback((vehicleId: string) => {
    if (concernFilter && vehicleConcernMap[vehicleId] !== concernFilter) return false;
    if (actorOnly && !actorVehicleIds.has(vehicleId)) return false;
    return true;
  }, [concernFilter, actorOnly, vehicleConcernMap, actorVehicleIds]);

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
      return {
        lat: p.lat, lng: p.lng,
        color: "#f1c40f",
        label: p.plate || "",
        data: {
          plate: p.plate,
          activityDescription: p.activityDescription,
          vehicleDescription: p.vehicleDescription,
          locationDescription: p.locationDescription,
          direction: p.direction,
          observedAt: p.observedAt,
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
        dispatchPins={filteredDispatches}
        watchpoints={watchpointsList}
        onPlacePin={(lat, lng) => { setPlacingPin({ lat, lng }); setSelectedPin(null); setSelectedMarker(null); setCreatingWatchpoint(null); setSelectedWatchpoint(null); }}
        onSaveWatchpoint={(lat, lng) => { setCreatingWatchpoint({ lat, lng }); setPlacingPin(null); setSelectedPin(null); setSelectedMarker(null); setSelectedWatchpoint(null); }}
        onPinClick={(pin) => { setSelectedPin(pin); setPlacingPin(null); setSelectedMarker(null); setCreatingWatchpoint(null); setSelectedWatchpoint(null); }}
        onMarkerClick={(marker) => { setSelectedMarker(marker); setSelectedPin(null); setPlacingPin(null); setCreatingWatchpoint(null); setSelectedWatchpoint(null); }}
        onWatchpointClick={(wp) => {
          setSelectedWatchpoint(wp);
          setSelectedPin(null); setPlacingPin(null); setSelectedMarker(null); setCreatingWatchpoint(null);
          // Load activity for this watchpoint
          setWpActivityLoading(true);
          setWatchpointActivity(null);
          api.getWatchpointActivity(wp.id).then(setWatchpointActivity).catch(() => setWatchpointActivity(null)).finally(() => setWpActivityLoading(false));
        }}
        height="100%"
      >
        {/* ── FILTER TRIGGER BUTTON ── */}
        <button onClick={() => setFilterOpen(!filterOpen)} style={{
          position: "absolute", top: 8, left: 48, zIndex: 1000,
          background: "var(--surface)", backdropFilter: "blur(8px)",
          border: "1px solid var(--border)", borderRadius: 10,
          padding: "7px 14px", display: "flex", alignItems: "center", gap: 6,
          cursor: "pointer", fontSize: 12, fontWeight: 600,
          color: activeFilterCount > 0 ? "var(--accent)" : "var(--text-sec)",
        }}>
          <Icon name="filter" size={14} />
          Filters
          {activeFilterCount > 0 && (
            <span style={{
              background: "var(--accent)", color: "var(--accent-text)",
              width: 18, height: 18, borderRadius: "50%", fontSize: 10, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>{activeFilterCount}</span>
          )}
        </button>

        {/* ── FILTER PANEL (collapsible) ── */}
        {filterOpen && (
          <div style={{
            position: "absolute", top: 44, left: 48, zIndex: 1000, width: 280,
            background: "var(--surface)", backdropFilter: "blur(12px)",
            border: "1px solid var(--border)", borderRadius: 12,
            padding: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          }} onClick={(e) => e.stopPropagation()}>
            {/* TIME */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase" }}>Time range</div>
              <div style={{ display: "flex", gap: 4 }}>
                {presets.map((p) => (
                  <button key={p.key} onClick={() => setRangePreset(p.key)} style={{
                    flex: 1, padding: "5px 0", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", textAlign: "center",
                    background: rangePreset === p.key ? "var(--accent)" : "transparent",
                    color: rangePreset === p.key ? "var(--accent-text)" : "var(--text-muted)",
                    border: rangePreset === p.key ? "1px solid var(--accent)" : "1px solid var(--border)",
                  }}>{p.label}</button>
                ))}
              </div>
            </div>

            {/* VEHICLE */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase" }}>Vehicle</div>
              <select value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)}
                style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 8px", fontSize: 12, color: "var(--text-sec)", colorScheme: "dark" }}>
                <option value="">All vehicles</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.plate || `${v.color} ${v.make} ${v.model}`.trim() || v.id.slice(0, 8)}</option>
                ))}
              </select>
            </div>

            {/* CONCERN LEVEL */}
            {concernLevels.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase" }}>Concern level</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  <button onClick={() => setConcernFilter("")} style={{
                    padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
                    background: !concernFilter ? "var(--accent)" : "transparent",
                    color: !concernFilter ? "var(--accent-text)" : "var(--text-muted)",
                    border: !concernFilter ? "1px solid var(--accent)" : "1px solid var(--border)",
                  }}>Any</button>
                  {concernLevels.sort((a: any, b: any) => a.sortOrder - b.sortOrder).map((l: any) => (
                    <button key={l.id} onClick={() => setConcernFilter(l.id)} style={{
                      padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
                      background: concernFilter === l.id ? (l.color || "var(--accent)") : "transparent",
                      color: concernFilter === l.id ? "#fff" : "var(--text-muted)",
                      border: `1px solid ${concernFilter === l.id ? (l.color || "var(--accent)") : "var(--border)"}`,
                    }}>{l.label}</button>
                  ))}
                </div>
              </div>
            )}

            {/* DISPATCHES */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase" }}>Dispatches</div>
              <div style={{ display: "flex", gap: 4 }}>
                {(["all", "active", "resolved", "hidden"] as const).map((opt) => (
                  <button key={opt} onClick={() => setDispatchFilter(opt)} style={{
                    flex: 1, padding: "4px 0", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", textAlign: "center",
                    textTransform: "capitalize",
                    background: dispatchFilter === opt ? "var(--accent)" : "transparent",
                    color: dispatchFilter === opt ? "var(--accent-text)" : "var(--text-muted)",
                    border: dispatchFilter === opt ? "1px solid var(--accent)" : "1px solid var(--border)",
                  }}>{opt}</button>
                ))}
              </div>
            </div>

            {/* PEOPLE */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase" }}>People</div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: "var(--text-sec)" }}>
                <input type="checkbox" checked={actorOnly} onChange={(e) => setActorOnly(e.target.checked)}
                  style={{ accentColor: "var(--accent)" }} />
                Only vehicles with linked actors
              </label>
            </div>

            {/* ACTIONS */}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { loadData(); setFilterOpen(false); }} disabled={loading}
                style={{ flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 12, fontWeight: 700, background: "var(--accent)", color: "var(--accent-text)", border: "none", cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
                {loading ? "Loading..." : "Apply"}
              </button>
              <button onClick={() => {
                setRangePreset("7d"); setVehicleFilter(""); setConcernFilter("");
                setDispatchFilter("all"); setActorOnly(false);
              }}
                style={{ padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)", cursor: "pointer" }}>
                Reset
              </button>
            </div>
          </div>
        )}

        {/* ── LEFT SIDE CONTROLS ── */}
        <div style={{
          position: "absolute", top: 90, left: 8, zIndex: 1000,
          display: "flex", flexDirection: "column", gap: 6,
        }}>
          {corridors.length > 0 && (
            <button onClick={() => setCorridors([])} style={{
              background: "var(--surface)", color: "var(--text-sec)", border: "1px solid var(--border)", borderRadius: 8,
              padding: "6px 12px", fontSize: 11, cursor: "pointer", backdropFilter: "blur(8px)",
            }}>Clear corridors</button>
          )}
        </div>

        {/* ── STATS + HINT (bottom) ── */}
        <div style={{
          position: "absolute", bottom: temporalBuckets.length > 0 ? 56 : 12, right: 12, zIndex: 1000,
          display: "flex", gap: 6, alignItems: "center",
        }}>
          <span style={{
            padding: "4px 10px", borderRadius: 20, fontSize: 10,
            background: "var(--surface)", color: "var(--text-muted)",
            backdropFilter: "blur(8px)",
          }}>Right-click map for pin or watchpoint</span>
          <span style={{
            padding: "4px 10px", borderRadius: 20, fontSize: 10, fontWeight: 600,
            background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)",
            backdropFilter: "blur(8px)",
          }}>{totalSightings} sightings</span>
          <span style={{
            padding: "4px 10px", borderRadius: 20, fontSize: 10, fontWeight: 600,
            background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)",
            backdropFilter: "blur(8px)",
          }}>{corridors.length} corridors</span>
          {watchpointsList.length > 0 && (
            <span style={{
              padding: "4px 10px", borderRadius: 20, fontSize: 10, fontWeight: 600,
              background: "var(--surface)", color: "#a78bfa", border: "1px solid var(--border)",
              backdropFilter: "blur(8px)",
            }}>{watchpointsList.length} watchpoint{watchpointsList.length !== 1 ? "s" : ""}</span>
          )}
        </div>

        {/* ── BOTTOM TIME SCRUBBER (floating on map) ── */}
        {temporalBuckets.length > 0 && (
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 1000,
            background: "var(--surface)", backdropFilter: "blur(8px)",
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

        {/* ── MAP LEGEND (bottom-left floating) ── */}
        <div style={{
          position: "absolute", bottom: temporalBuckets.length > 0 ? 80 : 8, left: 8, zIndex: 999,
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8,
          padding: "8px 12px", fontSize: 11, maxWidth: 220,
        }}>
          <div style={{ fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-sec)", marginBottom: 6 }}>Legend</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }} title="One reporter saw one vehicle at one location">
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: "rgba(255,200,0,0.8)", border: "2px solid rgba(255,180,0,0.6)" }} />
              <span style={{ color: "var(--text-sec)" }}>Sighting</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }} title="Multiple sightings near the same spot - reveals staging areas and repeat locations">
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: "rgba(231,76,60,0.5)", border: "2px dashed rgba(231,76,60,0.6)" }} />
              <span style={{ color: "var(--text-sec)" }}>Activity cluster</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }} title="Color gradient showing where activity concentrates - hot means busy, cold means quiet">
              <div style={{ width: 12, height: 12, background: "linear-gradient(90deg, #3b82f6, #facc15, #ef4444)", borderRadius: 2 }} />
              <span style={{ color: "var(--text-sec)" }}>Heatmap density</span>
            </div>
            {dispatchPins.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }} title="Operator-placed marker telling field reporters where to respond">
                <div style={{ width: 12, height: 12, background: "var(--accent)", borderRadius: 2, transform: "rotate(45deg)" }} />
                <span style={{ color: "var(--text-sec)" }}>Dispatch pin</span>
              </div>
            )}
            {watchpointsList.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }} title="Saved hotspot location - click to see nearby vehicle activity">
                <div style={{ width: 12, height: 12, background: "#8b5cf6", borderRadius: "50%", border: "2px solid #a78bfa" }} />
                <span style={{ color: "var(--text-sec)" }}>Watchpoint</span>
              </div>
            )}
          </div>
        </div>
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
            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, fontWeight: 700,
              background: selectedMarker.label === "Cluster" ? "#e74c3c" : "#f1c40f",
              color: "#000" }}>{selectedMarker.label === "Cluster" ? "Activity Zone" : "Sighting"}</span>
            <button onClick={() => setSelectedMarker(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>
          {selectedMarker.data?.plate && (
            <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: "0.1em", fontSize: 18, marginBottom: 4 }}>{selectedMarker.data.plate}</div>
          )}
          {selectedMarker.data?.triaged !== undefined && (
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em",
                background: selectedMarker.data.triaged ? "rgba(34,197,94,0.15)" : "rgba(217,119,6,0.15)",
                color: selectedMarker.data.triaged ? "#22c55e" : "#d97706",
              }}>{selectedMarker.data.triaged ? "Reviewed" : "Pending"}</span>
            </div>
          )}
          {selectedMarker.data?.activityDescription && <p style={{ fontSize: 13, color: "var(--text-sec)", marginBottom: 8, lineHeight: 1.5 }}>{selectedMarker.data.activityDescription}</p>}

          {/* Vehicle card with photo */}
          {markerVehicle && (
            <div style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {markerVehicle.photoUrl && (
                  <img src={markerVehicle.photoUrl} alt="" style={{ width: 48, height: 48, borderRadius: 6, objectFit: "cover" }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14 }}>{markerVehicle.plate}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {[markerVehicle.color, markerVehicle.year, markerVehicle.make, markerVehicle.model].filter(Boolean).join(" ")}
                  </div>
                </div>
              </div>
              {markerVehicle.concernHistory?.length > 0 && (
                <div style={{ marginTop: 6, fontSize: 10, color: "var(--text-muted)" }}>
                  {markerVehicle.recentSightings?.length || 0} sightings on record
                </div>
              )}
              {markerVehicle.linkedActors?.length > 0 && (
                <div style={{ marginTop: 8, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-sec)", marginBottom: 4 }}>Linked actors</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {markerVehicle.linkedActors.map((a: any) => (
                      <div key={a.actorId} onClick={() => { window.dispatchEvent(new CustomEvent("trace-navigate", { detail: "actors" })); }}
                        style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 6,
                          background: "var(--surface)", border: "1px solid var(--border)", cursor: "pointer", fontSize: 11 }}>
                        {a.photoUrl && <img src={a.photoUrl} alt="" style={{ width: 18, height: 18, borderRadius: "50%", objectFit: "cover" }} />}
                        <span style={{ color: "var(--accent)" }}>{a.alias || "Unknown"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {selectedMarker.data?.vehicleDescription && !markerVehicle && (
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8, padding: "6px 10px", background: "var(--surface-alt)", borderRadius: 6 }}>
              {selectedMarker.data.vehicleDescription}
            </div>
          )}
          {selectedMarker.data?.locationDescription && (
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ opacity: 0.6 }}>📍</span> {selectedMarker.data.locationDescription}
            </div>
          )}
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12, display: "flex", flexDirection: "column", gap: 4 }}>
            {selectedMarker.data?.observedAt && <span>Observed: {new Date(selectedMarker.data.observedAt).toLocaleString()}</span>}
            {selectedMarker.data?.direction && <span>Heading: {selectedMarker.data.direction}</span>}
            <span>Coordinates: {selectedMarker.lat.toFixed(5)}, {selectedMarker.lng.toFixed(5)}</span>
            {selectedMarker.data?.reporterCallsign && <span>Reporter: <strong style={{ color: "var(--text-sec)" }}>{selectedMarker.data.reporterCallsign}</strong></span>}
          </div>

          {/* Vehicle link */}
          {selectedMarker.data?.vehicleId && (
            <button onClick={() => { window.dispatchEvent(new CustomEvent("trace-navigate", { detail: "vehicles" })); }}
              style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "8px 12px", marginBottom: 12,
                background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer",
                fontSize: 12, color: "var(--accent)", textAlign: "left" }}>
              <span style={{ fontSize: 14 }}>🚗</span>
              <span>View vehicle record for {selectedMarker.data.plate}</span>
            </button>
          )}

          {/* Nearby sightings for cluster clicks */}
          {selectedMarker.label === "Cluster" && temporalMarkers.length > 0 && (() => {
            const nearby = temporalMarkers.filter(m => {
              const d = Math.sqrt(Math.pow(m.lat - selectedMarker.lat, 2) + Math.pow(m.lng - selectedMarker.lng, 2));
              return d < 0.005; // ~500m radius
            });
            if (nearby.length === 0) return null;
            return (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: "var(--text-sec)" }}>{nearby.length} sighting{nearby.length !== 1 ? "s" : ""} in this area</div>
                {nearby.slice(0, 8).map((n, i) => (
                  <div key={i} onClick={() => setSelectedMarker(n)} style={{
                    fontSize: 11, padding: "6px 8px", marginBottom: 4, borderRadius: 6, cursor: "pointer",
                    background: "var(--surface-alt)", border: "1px solid var(--border)",
                  }}>
                    {n.data?.plate && <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, marginRight: 6 }}>{n.data.plate}</span>}
                    <span style={{ color: "var(--text-muted)" }}>{n.data?.activityDescription?.slice(0, 60)}...</span>
                  </div>
                ))}
              </div>
            );
          })()}

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
          {(selectedPin.status === "closed" || selectedPin.status === "expired") && (
            <button onClick={async () => {
              try {
                const token = localStorage.getItem("trace_op_token");
                await fetch(`${getApiBase()}/dispatches/${selectedPin.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                  body: JSON.stringify({ status: "active" }),
                });
                setSelectedPin(null);
                loadDispatchPins();
              } catch {}
            }}
              style={{ width: "100%", background: "var(--accent)", color: "var(--accent-text)", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Reopen Dispatch
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
            watchpoints={watchpointsList}
            vehicleGroups={vehicleGroups}
            vehicles={vehicles}
            onSave={async (data) => {
              try {
                await api.createDispatch({ ...data, lat: placingPin.lat, lng: placingPin.lng });
                setPlacingPin(null);
                // Remove temp pin marker
                const mapEl = document.querySelector(".leaflet-container") as any;
                const map = mapEl?._leaflet_map;
                if (map?._tempPin) { map._tempPin.remove(); map._tempPin = null; }
                loadDispatchPins();
              } catch {}
            }}
            onCancel={() => {
              setPlacingPin(null);
              // Remove temp pin marker from map
              const mapEl = document.querySelector(".leaflet-container") as any;
              const map = mapEl?._leaflet_map;
              if (map?._tempPin) { map._tempPin.remove(); map._tempPin = null; }
            }}
          />
        </div>
      )}

      {/* Watchpoint creation form */}
      {creatingWatchpoint && (
        <div style={{
          position: "absolute", top: 0, right: 0, bottom: 0, width: 380, zIndex: 10001,
          background: "var(--surface)", borderLeft: "1px solid var(--border)",
          padding: 20, overflowY: "auto",
          boxShadow: "-4px 0 20px rgba(0,0,0,0.3)",
        }}>
          <WatchpointCreationForm
            lat={creatingWatchpoint.lat}
            lng={creatingWatchpoint.lng}
            onSave={async (data) => {
              try {
                await api.createWatchpoint({ ...data, lat: creatingWatchpoint.lat, lng: creatingWatchpoint.lng });
                setCreatingWatchpoint(null);
                loadWatchpoints();
              } catch {}
            }}
            onCancel={() => setCreatingWatchpoint(null)}
          />
        </div>
      )}

      {/* Watchpoint activity panel */}
      {selectedWatchpoint && (
        <div style={{
          position: "absolute", top: 0, right: 0, bottom: 0, width: 380, zIndex: 10001,
          background: "var(--surface)", borderLeft: "1px solid var(--border)",
          padding: 20, overflowY: "auto",
          boxShadow: "-4px 0 20px rgba(0,0,0,0.3)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, fontWeight: 700, background: "#8b5cf6", color: "#fff" }}>Watchpoint</span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{selectedWatchpoint.name}</span>
            </div>
            <button onClick={() => { setSelectedWatchpoint(null); setWatchpointActivity(null); }} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>

          {selectedWatchpoint.address && (
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ opacity: 0.6 }}>📍</span> {selectedWatchpoint.address}
            </div>
          )}
          {selectedWatchpoint.cityGroup && (
            <div style={{ fontSize: 11, color: "#a78bfa", marginBottom: 8 }}>{selectedWatchpoint.cityGroup}</div>
          )}
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>
            Radius: {selectedWatchpoint.radiusMeters || 200}m · {selectedWatchpoint.lat.toFixed(5)}, {selectedWatchpoint.lng.toFixed(5)}
          </div>

          {/* Activity section */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-sec)", marginBottom: 8 }}>Vehicle activity (last 14 days)</div>
            {wpActivityLoading && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Loading activity...</div>}
            {!wpActivityLoading && watchpointActivity && (
              <>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
                  {watchpointActivity.totalSightings} sighting{watchpointActivity.totalSightings !== 1 ? "s" : ""} · {watchpointActivity.vehicles?.length || 0} vehicle{(watchpointActivity.vehicles?.length || 0) !== 1 ? "s" : ""}
                </div>
                {watchpointActivity.vehicles?.map((v: any) => (
                  <div key={v.vehicleId} onClick={() => { window.dispatchEvent(new CustomEvent("trace-navigate", { detail: "vehicles" })); }}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "8px 10px", marginBottom: 4, borderRadius: 6, cursor: "pointer",
                      background: "var(--surface-alt, rgba(255,255,255,0.03))", border: "1px solid var(--border)",
                    }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 13 }}>{v.plate || "No plate"}</div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{[v.color, v.make, v.model].filter(Boolean).join(" ")}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>{v.count}</div>
                      <div style={{ fontSize: 9, color: "var(--text-muted)" }}>
                        {v.lastSeen ? new Date(v.lastSeen).toLocaleDateString() : ""}
                      </div>
                    </div>
                  </div>
                ))}
                {(!watchpointActivity.vehicles || watchpointActivity.vehicles.length === 0) && (
                  <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>No vehicles sighted in this area recently.</div>
                )}
              </>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => {
              setPlacingPin({ lat: selectedWatchpoint.lat, lng: selectedWatchpoint.lng });
              setSelectedWatchpoint(null); setWatchpointActivity(null);
            }}
              style={{ flex: 1, background: "var(--accent)", color: "var(--accent-text)", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Dispatch here
            </button>
            <button onClick={async () => {
              if (confirm("Delete this watchpoint?")) {
                await api.deleteWatchpoint(selectedWatchpoint.id).catch(() => {});
                setSelectedWatchpoint(null); setWatchpointActivity(null);
                loadWatchpoints();
              }
            }}
              style={{ padding: "10px 12px", background: "var(--surface-alt, var(--bg))", color: "#ef4444", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>
              Delete
            </button>
          </div>
        </div>
      )}

      {/* No data message */}
      {temporalBuckets.length === 0 && !loading && (
        <div style={{
          position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", zIndex: 1000,
          background: "var(--surface)", backdropFilter: "blur(8px)", border: "1px solid var(--border)",
          borderRadius: 8, padding: "8px 20px", fontSize: 12, color: "var(--text-muted)",
        }}>
          No sighting data in this range.{vehicleFilter ? " Remove the vehicle filter." : " Expand the date range."}
        </div>
      )}
    </div>
  );
}


// --- Pin Creation Form ---
function PinCreationForm({ lat, lng, eventTypes, reporters, watchpoints, vehicleGroups, vehicles, onSave, onCancel }: {
  lat: number; lng: number; eventTypes: any[]; reporters: any[]; watchpoints?: any[]; vehicleGroups?: any[]; vehicles?: any[];
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

      {/* Vehicle / Group picker */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <select value={plate} onChange={(e) => setPlate(e.target.value)}
          className="bg-trace-bg border border-trace-border rounded-lg px-3 py-2 text-sm" style={{ colorScheme: "dark" }}>
          <option value="">Vehicle (optional)</option>
          {(vehicles || []).map((v: any) => (
            <option key={v.id} value={v.plate || ""}>{v.plate || v.id.slice(0, 8)} {[v.color, v.make].filter(Boolean).join(" ")}</option>
          ))}
        </select>
        {vehicleGroups && vehicleGroups.length > 0 && (
          <select defaultValue="" onChange={(e) => {
            const g = vehicleGroups?.find((g: any) => g.id === e.target.value);
            if (g) {
              const memberPlates = (g.members || []).map((m: any) => m.plate).filter(Boolean);
              if (memberPlates.length > 0) setPlate(memberPlates[0]);
              setNotes(`Group: ${g.name} (${memberPlates.join(", ")})`);
            }
            e.target.value = "";
          }}
            className="bg-trace-bg border border-trace-border rounded-lg px-3 py-2 text-sm" style={{ colorScheme: "dark" }}>
            <option value="">Group → fill plates</option>
            {vehicleGroups.map((g: any) => (
              <option key={g.id} value={g.id}>{g.name} ({g.members?.length || 0})</option>
            ))}
          </select>
        )}
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

      {/* Watchpoint quick-fill */}
      {watchpoints && watchpoints.length > 0 && (
        <div className="mb-3">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>Or use a saved watchpoint:</span>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {(() => {
              const grouped: Record<string, any[]> = {};
              watchpoints.forEach(wp => { const c = wp.cityGroup || "Other"; if (!grouped[c]) grouped[c] = []; grouped[c].push(wp); });
              return Object.entries(grouped).map(([city, wps]) => (
                <div key={city} style={{ width: "100%" }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 4, marginBottom: 2 }}>{city}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {wps.map((wp: any) => (
                      <button key={wp.id} onClick={() => setNotes(`${wp.name}${wp.address ? ` - ${wp.address}` : ""}`)}
                        className="px-2.5 py-1 rounded text-xs"
                        style={{ background: "var(--bg)", color: "var(--text-sec)", border: "1px solid var(--border)" }}>
                        ⭐ {wp.name}
                      </button>
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

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

// --- Watchpoint Creation Form ---
function WatchpointCreationForm({ lat, lng, onSave, onCancel }: {
  lat: number; lng: number;
  onSave: (data: any) => void; onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [cityGroup, setCityGroup] = useState("");
  const [radiusMeters, setRadiusMeters] = useState("200");
  const [saving, setSaving] = useState(false);

  return (
    <div className="mt-4 bg-trace-surface rounded-lg p-5 border border-trace-border">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span>⭐</span> Save as Watchpoint
        </h3>
        <button onClick={onCancel} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>✕</button>
      </div>
      <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
        Save this location as a hotspot for quick access. Watchpoints show nearby vehicle activity.
      </p>

      <div className="mb-3">
        <input placeholder="Name (e.g. Wilbur Apartments)" value={name}
          onChange={(e) => setName(e.target.value)} autoFocus
          className="w-full bg-trace-bg border border-trace-border rounded-lg px-3 py-2 text-sm" />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <input placeholder="Address (optional)" value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="bg-trace-bg border border-trace-border rounded-lg px-3 py-2 text-sm" />
        <input placeholder="City group (e.g. Thousand Oaks)" value={cityGroup}
          onChange={(e) => setCityGroup(e.target.value)}
          className="bg-trace-bg border border-trace-border rounded-lg px-3 py-2 text-sm" />
      </div>

      <div className="mb-3">
        <label className="text-xs" style={{ color: "var(--text-muted)" }}>Detection radius: {radiusMeters}m</label>
        <input type="range" min="50" max="1000" step="50" value={radiusMeters}
          onChange={(e) => setRadiusMeters(e.target.value)}
          style={{ width: "100%", accentColor: "#8b5cf6" }} />
      </div>

      <div className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
        📍 {lat.toFixed(5)}, {lng.toFixed(5)}
      </div>

      <div className="flex gap-2">
        <button onClick={async () => {
          if (!name.trim()) return;
          setSaving(true);
          await onSave({
            name: name.trim(),
            address: address.trim() || undefined,
            cityGroup: cityGroup.trim() || undefined,
            radiusMeters: parseInt(radiusMeters) || 200,
          });
          setSaving(false);
        }} disabled={saving || !name.trim()}
          className="flex-1 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50"
          style={{ background: "#8b5cf6", color: "#fff", border: "none" }}>
          {saving ? "Saving..." : "Save Watchpoint"}
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm"
          style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-sec)" }}>
          Cancel
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
