/**
 * TRACE PWA — Reporter Map
 *
 * Shows active dispatch pins and own sightings.
 * Does NOT show full intel (heatmaps, corridors, suspicion levels).
 * If device is taken, adversary sees only time-limited dispatch pins.
 */
import { useState, useEffect, useRef } from "preact/hooks";
import { Icon } from "../components/icon.js";
import { api } from "../lib/api.js";

declare const L: any;

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#DC2626",
  routine: "#D97706",
  info: "#64748B",
};

const SATELLITE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

export function ReporterMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<any>(null);
  const markersRef = useRef<any>(null);
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [selectedDispatch, setSelectedDispatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);

  // Get user location
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setUserPos([pos.coords.latitude, pos.coords.longitude]),
      () => setUserPos([34.27, -118.78]), // Simi Valley fallback
      { enableHighAccuracy: true }
    );
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || leafletRef.current || !userPos) return;

    const map = L.map(mapRef.current, { zoomControl: true }).setView(userPos, 14);
    L.tileLayer(SATELLITE_URL, { attribution: "© Esri", maxZoom: 19 }).addTo(map);

    // User location marker
    L.circleMarker(userPos, {
      radius: 8, color: "#4F8EF7", fillColor: "#4F8EF7",
      fillOpacity: 0.9, weight: 2,
    }).addTo(map).bindTooltip("You", { permanent: false });

    markersRef.current = L.layerGroup().addTo(map);
    leafletRef.current = map;

    return () => { map.remove(); leafletRef.current = null; };
  }, [userPos]);

  // Load dispatches
  const loadDispatches = async () => {
    setLoading(true);
    try {
      const data = await api.getActiveDispatches();
      setDispatches(data as any[]);
    } catch (e) {
      console.error("Failed to load dispatches:", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDispatches();
    const interval = setInterval(loadDispatches, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  // Render dispatch pins on map
  useEffect(() => {
    if (!markersRef.current) return;
    markersRef.current.clearLayers();

    dispatches.forEach((d) => {
      const color = PRIORITY_COLORS[d.priority] || PRIORITY_COLORS.routine;
      const isAssigned = d.assigned;

      const marker = L.circleMarker([d.lat, d.lng], {
        radius: isAssigned ? 14 : 11,
        color: color,
        fillColor: color,
        fillOpacity: 0.25,
        weight: isAssigned ? 3 : 2,
      });

      marker.on("click", () => setSelectedDispatch(d));
      marker.addTo(markersRef.current);

      // Priority label
      if (d.priority === "urgent") {
        L.marker([d.lat, d.lng], {
          icon: L.divIcon({
            className: "",
            html: `<div style="background:${color};color:#fff;font-size:9px;font-weight:700;padding:1px 4px;border-radius:3px;white-space:nowrap;">URGENT</div>`,
            iconSize: [0, 0],
            iconAnchor: [0, -12],
          }),
        }).addTo(markersRef.current);
      }
    });
  }, [dispatches]);

  const timeAgo = (iso: string) => {
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
    return `${Math.round(mins / 1440)}d ago`;
  };

  const openInMaps = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, "_blank");
  };

  const handleRespond = async (id: string) => {
    try {
      await api.respondToDispatch(id);
      setSelectedDispatch((prev: any) => prev ? { ...prev, myAssignment: { ...prev.myAssignment, status: "responding" } } : null);
      loadDispatches();
    } catch { /* silent */ }
  };

  const handleArrive = async (id: string) => {
    try {
      await api.arriveAtDispatch(id);
      setSelectedDispatch((prev: any) => prev ? { ...prev, myAssignment: { ...prev.myAssignment, status: "on_scene" } } : null);
      loadDispatches();
    } catch { /* silent */ }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 80px)", position: "relative" }}>
      {/* Header */}
      <div style={{ padding: "var(--sp-3) var(--sp-4)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span class="section-label" style={{ marginBottom: 0 }}>Dispatch Map</span>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginLeft: "var(--sp-2)" }}>
            {dispatches.length} active
          </span>
        </div>
        <button onClick={loadDispatches} style={{
          background: "none", border: "none", color: "var(--accent)",
          fontSize: "var(--text-xs)", cursor: "pointer",
        }}>
          Refresh
        </button>
      </div>

      {/* Map */}
      <div ref={mapRef} style={{ flex: 1, minHeight: 300, borderRadius: "var(--radius)" }} />

      {/* Dispatch detail card (overlay) */}
      {selectedDispatch && (
        <div style={{
          position: "absolute", bottom: 90, left: "var(--sp-3)", right: "var(--sp-3)",
          background: "var(--surface)", borderRadius: "var(--radius)",
          border: "1px solid var(--border)", padding: "var(--sp-4)",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.15)", zIndex: 1000,
        }}>
          {/* Close button */}
          <button onClick={() => setSelectedDispatch(null)} style={{
            position: "absolute", top: 8, right: 8, background: "none",
            border: "none", color: "var(--text-muted)", cursor: "pointer",
          }}>
            <Icon name="x" size={16} />
          </button>

          {/* Priority badge */}
          <div style={{
            display: "inline-block", fontSize: "10px", fontWeight: 700,
            padding: "2px 8px", borderRadius: 4, marginBottom: "var(--sp-2)",
            background: PRIORITY_COLORS[selectedDispatch.priority] || "#64748B",
            color: "#fff", textTransform: "uppercase",
          }}>
            {selectedDispatch.priority}
          </div>

          {/* Plate and location */}
          {selectedDispatch.plate && (
            <div style={{ fontFamily: "monospace", fontSize: "var(--text-lg)", fontWeight: 700, letterSpacing: "0.1em" }}>
              {selectedDispatch.plate}
            </div>
          )}
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: "var(--sp-1)" }}>
            {selectedDispatch.lat?.toFixed(4)}, {selectedDispatch.lng?.toFixed(4)} — {timeAgo(selectedDispatch.createdAt)}
          </div>

          {/* Notes */}
          {selectedDispatch.notes && (
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-sec)", marginTop: "var(--sp-2)" }}>
              {selectedDispatch.notes}
            </p>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: "var(--sp-2)", marginTop: "var(--sp-3)" }}>
            {selectedDispatch.assigned && selectedDispatch.myAssignment?.status === "assigned" && (
              <button onClick={() => handleRespond(selectedDispatch.id)} class="btn btn-primary" style={{ flex: 1 }}
                title="Let dispatch know you are heading to this location">
                Responding
              </button>
            )}
            {selectedDispatch.assigned && selectedDispatch.myAssignment?.status === "responding" && (
              <button onClick={() => handleArrive(selectedDispatch.id)} class="btn btn-primary" style={{ flex: 1 }}
                title="Let dispatch know you have arrived at this location">
                On Scene
              </button>
            )}
            {selectedDispatch.assigned && selectedDispatch.myAssignment?.status === "on_scene" && (
              <span style={{ fontSize: "var(--text-sm)", color: "var(--success)", fontWeight: 600, display: "flex", alignItems: "center", gap: "var(--sp-1)" }}>
                ✓ On Scene — submit a report from the Report tab
              </span>
            )}
            <button onClick={() => openInMaps(selectedDispatch.lat, selectedDispatch.lng)}
              class="btn btn-secondary" style={{ flex: selectedDispatch.assigned ? 0 : 1 }}
              title="Open turn-by-turn directions in your maps app">
              <Icon name="compass" size={14} /> Navigate
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && dispatches.length === 0 && (
        <div style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          textAlign: "center", color: "var(--text-muted)", fontSize: "var(--text-sm)",
          background: "var(--surface)", padding: "var(--sp-4) var(--sp-5)", borderRadius: "var(--radius)",
          border: "1px solid var(--border)", maxWidth: 280,
        }}>
          <Icon name="map-pin" size={24} />
          <p style={{ marginTop: "var(--sp-2)", fontWeight: 500 }}>No active dispatches</p>
          <p style={{ fontSize: "var(--text-xs)", marginTop: "var(--sp-1)", lineHeight: 1.5 }}>
            When your operator sends you to a location, a pin will appear here with details and directions. The map updates automatically.
          </p>
        </div>
      )}
    </div>
  );
}
