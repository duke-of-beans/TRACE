/**
 * TRACE Operator — Intelligence Map
 *
 * Full geospatial visualization:
 * - Heatmap layer (sighting density)
 * - Vehicle corridor polylines
 * - Co-occurrence zone markers
 * - Time slider for temporal filtering
 * - Actor territory overlays
 *
 * Uses Leaflet.js + leaflet.heat for heatmaps.
 */
import { useEffect, useRef, useCallback, useState } from "react";
import L from "leaflet";

// ---------- Types ----------

type HeatmapPoint = { lat: number; lng: number; weight: number };
type CorridorSegment = {
  from: { lat: number; lng: number; observedAt: string };
  to: { lat: number; lng: number; observedAt: string };
};
type CoOccurrence = {
  vehicleA: string; vehicleB: string;
  lat: number; lng: number; count: number;
};
type MapMarker = {
  lat: number; lng: number;
  label?: string; color?: string; popup?: string;
  data?: Record<string, any>;
};

type DispatchPin = {
  id: string;
  lat: number;
  lng: number;
  priority: string;
  status: string;
  plate?: string;
  notes?: string;
  eventTypeLabel?: string;
  eventTypeIcon?: string;
  eventTypeColor?: string;
  createdAt: string;
};

type IntelMapProps = {
  markers?: MapMarker[];
  highlightedMarkers?: MapMarker[];
  heatmapData?: HeatmapPoint[];
  corridors?: { vehicleId: string; color: string; segments: CorridorSegment[] }[];
  coOccurrences?: CoOccurrence[];
  dispatchPins?: DispatchPin[];
  onPlacePin?: (lat: number, lng: number) => void;
  onPinClick?: (pin: DispatchPin) => void;
  onMarkerClick?: (marker: MapMarker) => void;
  center?: [number, number];
  zoom?: number;
  height?: string;
  children?: React.ReactNode;
};

// layer group refs for clean updates
type LayerRefs = {
  markers: L.LayerGroup;
  highlighted: L.LayerGroup;
  heatmap: L.LayerGroup;
  corridors: L.LayerGroup;
  coOccurrences: L.LayerGroup;
  dispatchPins: L.LayerGroup;
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#DC2626",
  routine: "#D97706",
  info: "#64748B",
};

const TILES = {
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attr: "&copy; OSM &copy; CARTO",
  },
  light: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attr: "&copy; OSM &copy; CARTO",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attr: "&copy; Esri",
  },
};

type TileMode = keyof typeof TILES;

export function IntelMap({
  markers = [],
  highlightedMarkers = [],
  heatmapData = [],
  corridors = [],
  coOccurrences = [],
  dispatchPins = [],
  onPlacePin,
  onPinClick,
  onMarkerClick,
  center = [38.9310, -77.1770],
  zoom = 12,
  height = "500px",
  children,
}: IntelMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<L.Map | null>(null);
  const layersRef = useRef<LayerRefs | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const [tileMode, setTileMode] = useState<TileMode>("satellite");
  // Stable refs for callbacks to avoid effect re-triggers
  const onPinClickRef = useRef(onPinClick);
  onPinClickRef.current = onPinClick;
  const onMarkerClickRef = useRef(onMarkerClick);
  onMarkerClickRef.current = onMarkerClick;

  // switch tile layer
  const switchTiles = useCallback((mode: TileMode) => {
    const map = leafletRef.current;
    if (!map) return;
    if (tileRef.current) map.removeLayer(tileRef.current);
    const t = TILES[mode];
    tileRef.current = L.tileLayer(t.url, { attribution: t.attr, maxZoom: 19 }).addTo(map);
    setTileMode(mode);
  }, []);

  // initialize map
  useEffect(() => {
    if (!mapRef.current || leafletRef.current) return;

    const map = L.map(mapRef.current, { zoomControl: true }).setView(center, zoom);

    // Inject pulse animation CSS
    if (!document.getElementById("trace-pulse-css")) {
      const style = document.createElement("style");
      style.id = "trace-pulse-css";
      style.textContent = `
        @keyframes pulse {
          0% { opacity: 1; box-shadow: 0 0 8px rgba(217,119,6,0.5); }
          50% { opacity: 0.6; box-shadow: 0 0 20px rgba(217,119,6,0.8); }
          100% { opacity: 1; box-shadow: 0 0 8px rgba(217,119,6,0.5); }
        }
      `;
      document.head.appendChild(style);
    }

    // default tiles
    const t = TILES.satellite;
    tileRef.current = L.tileLayer(t.url, { attribution: t.attr, maxZoom: 19 }).addTo(map);

    const layers: LayerRefs = {
      heatmap: L.layerGroup().addTo(map),
      corridors: L.layerGroup().addTo(map),
      coOccurrences: L.layerGroup().addTo(map),
      markers: L.layerGroup().addTo(map),
      highlighted: L.layerGroup().addTo(map),
      dispatchPins: L.layerGroup().addTo(map),
    };

    // layer control
    L.control.layers({}, {
      "Sightings": layers.markers,
      "Highlighted": layers.highlighted,
      "Heatmap": layers.heatmap,
      "Corridors": layers.corridors,
      "Co-occurrence": layers.coOccurrences,
      "Dispatch Pins": layers.dispatchPins,
    }, { collapsed: false, position: "topright" }).addTo(map);

    leafletRef.current = map;
    layersRef.current = layers;

    // Right-click / long-press to place dispatch pin
    map.on("contextmenu", (e: any) => {
      if (onPlacePin) {
        e.originalEvent.preventDefault();
        // Drop a temporary pulsing marker immediately
        const tempMarker = L.marker([e.latlng.lat, e.latlng.lng], {
          icon: L.divIcon({
            className: "",
            html: `<div style="
              width:32px;height:32px;transform:rotate(45deg);
              border:3px solid #D97706;background:rgba(217,119,6,0.3);
              border-radius:4px;
              animation:pulse 1.5s infinite;
              box-shadow:0 0 12px rgba(217,119,6,0.5);
            "></div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          }),
        }).addTo(map);
        // Store for cleanup
        if ((map as any)._tempPin) (map as any)._tempPin.remove();
        (map as any)._tempPin = tempMarker;
        onPlacePin(e.latlng.lat, e.latlng.lng);
      }
    });

    return () => { map.remove(); leafletRef.current = null; };
  }, []);

  // --- Markers ---
  useEffect(() => {
    const layer = layersRef.current?.markers;
    if (!layer) return;
    layer.clearLayers();

    markers.forEach((m) => {
      const cm = L.circleMarker([m.lat, m.lng], {
        radius: 12,
        fillColor: m.color || "#818CF8",
        color: "#fff", weight: 2, opacity: 1, fillOpacity: 0.9,
      })
        .bindTooltip(m.label ? `<b>${m.label}</b>` : `${m.lat.toFixed(4)}, ${m.lng.toFixed(4)}`, { permanent: false })
        .addTo(layer);

      cm.on("click", () => {
        if (onMarkerClickRef.current) {
          onMarkerClickRef.current(m);
          setTimeout(() => {
            const panel = document.querySelector("[data-trace-panel]");
            if (panel) panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }, 100);
        }
      });
    });

    fitBounds(markers.map((m) => [m.lat, m.lng]));
  }, [markers]);

  // --- Highlighted Markers (selected vehicle sightings) ---
  useEffect(() => {
    const layer = layersRef.current?.highlighted;
    if (!layer) return;
    layer.clearLayers();

    highlightedMarkers.forEach((m) => {
      // outer pulse ring
      L.circleMarker([m.lat, m.lng], {
        radius: 14,
        fillColor: m.color || "#818CF8",
        color: m.color || "#818CF8",
        weight: 2,
        opacity: 0.3,
        fillOpacity: 0.1,
        className: "trace-pulse-ring",
      }).addTo(layer);

      // inner solid marker
      L.circleMarker([m.lat, m.lng], {
        radius: 9,
        fillColor: m.color || "#818CF8",
        color: "#fff",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.95,
      })
        .bindPopup(m.popup || `${m.lat.toFixed(4)}, ${m.lng.toFixed(4)}`)
        .bindTooltip(m.label || "", { permanent: false })
        .addTo(layer);
    });

    // fit to highlighted if present, otherwise markers
    if (highlightedMarkers.length > 0) {
      fitBounds(highlightedMarkers.map((m) => [m.lat, m.lng]));
    }
  }, [highlightedMarkers]);

  // --- Heatmap (canvas circles with opacity by weight) ---
  useEffect(() => {
    const layer = layersRef.current?.heatmap;
    if (!layer) return;
    layer.clearLayers();

    heatmapData.forEach((p) => {
      const cm = L.circleMarker([p.lat, p.lng], {
        radius: 15 + p.weight * 20,
        fillColor: weightToColor(p.weight),
        color: "transparent",
        fillOpacity: 0.15 + p.weight * 0.2,
      });
      cm.bindTooltip(`<div style="font-family:system-ui;font-size:11px;">
        <div style="font-weight:600;">Activity cluster</div>
        <div style="color:#999;">${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}</div>
        <div style="color:#999;">Density: ${Math.round(p.weight * 100)}%</div>
      </div>`, { direction: "top" });
      cm.on("click", () => {
        if (onMarkerClickRef.current) {
          onMarkerClickRef.current({
            lat: p.lat, lng: p.lng, color: weightToColor(p.weight),
            label: "Cluster",
            data: { activityDescription: `Activity cluster (${Math.round(p.weight * 100)}% density)`, observedAt: null },
          });
        }
      });
      cm.addTo(layer);
    });
  }, [heatmapData]);

  // --- Corridors (polylines) ---
  useEffect(() => {
    const layer = layersRef.current?.corridors;
    if (!layer) return;
    layer.clearLayers();

    corridors.forEach((corridor) => {
      if (corridor.segments.length === 0) return;

      // build polyline from segments
      const latlngs: L.LatLngExpression[] = [
        [corridor.segments[0].from.lat, corridor.segments[0].from.lng],
      ];
      corridor.segments.forEach((seg) => {
        latlngs.push([seg.to.lat, seg.to.lng]);
      });

      L.polyline(latlngs, {
        color: corridor.color,
        weight: 3,
        opacity: 0.7,
        dashArray: "8 4",
      })
        .bindPopup(`Vehicle corridor`)
        .addTo(layer);

      // start/end markers
      const start = corridor.segments[0].from;
      const end = corridor.segments[corridor.segments.length - 1].to;

      L.circleMarker([start.lat, start.lng], {
        radius: 5, fillColor: corridor.color, color: "#fff",
        weight: 2, fillOpacity: 1,
      }).bindTooltip("First sighting").addTo(layer);

      L.circleMarker([end.lat, end.lng], {
        radius: 8, fillColor: corridor.color, color: "#fff",
        weight: 2, fillOpacity: 1,
      }).bindTooltip("Latest sighting").addTo(layer);
    });
  }, [corridors]);

  // --- Co-occurrence zones ---
  useEffect(() => {
    const layer = layersRef.current?.coOccurrences;
    if (!layer) return;
    layer.clearLayers();

    coOccurrences.forEach((co) => {
      L.circle([co.lat, co.lng], {
        radius: 200, // meters
        fillColor: "#ff6b6b",
        color: "#ff6b6b",
        weight: 2,
        fillOpacity: 0.15,
        dashArray: "4 4",
      })
        .bindPopup(
          `<strong>Co-occurrence Zone</strong><br>` +
          `Vehicles seen within 200m / 60min`
        )
        .addTo(layer);
    });
  }, [coOccurrences]);

  // --- Helpers ---
  const fitBounds = useCallback((points: number[][]) => {
    const map = leafletRef.current;
    if (!map || points.length === 0) return;
    const bounds = L.latLngBounds(points as L.LatLngExpression[]);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, []);

  // --- Dispatch Pins ---
  useEffect(() => {
    const layer = layersRef.current?.dispatchPins;
    if (!layer) return;
    layer.clearLayers();

    dispatchPins.forEach((pin) => {
      const color = pin.eventTypeColor || PRIORITY_COLORS[pin.priority] || PRIORITY_COLORS.routine;
      const isDraft = pin.status === "draft";

      const iconHtml = `<div style="
        width:28px;height:28px;transform:rotate(45deg);
        background:${isDraft ? "transparent" : color};
        border:3px solid ${color};
        border-radius:4px;display:flex;align-items:center;justify-content:center;
        box-shadow:0 2px 8px rgba(0,0,0,0.3);
      "><span style="transform:rotate(-45deg);font-size:10px;color:#fff;font-weight:700;">
        ${pin.priority === "urgent" ? "!" : ""}
      </span></div>`;

      const marker = L.marker([pin.lat, pin.lng], {
        icon: L.divIcon({ className: "", html: iconHtml, iconSize: [28, 28], iconAnchor: [14, 14] }),
      });

      const timeAgo = (() => {
        const mins = Math.round((Date.now() - new Date(pin.createdAt).getTime()) / 60000);
        if (mins < 1) return "just now";
        if (mins < 60) return `${mins}m ago`;
        return `${Math.round(mins / 60)}h ago`;
      })();

      marker.bindTooltip(`<div style="min-width:120px;font-family:system-ui;font-size:11px;">
        <div style="font-weight:700;">${pin.eventTypeLabel || "Dispatch"}</div>
        ${pin.plate ? `<div style="font-family:monospace;">${pin.plate}</div>` : ""}
        <div style="color:#999;">${timeAgo} · ${pin.status}</div>
      </div>`, { direction: "top", offset: [0, -10] });

      marker.on("click", () => {
        if (onPinClickRef.current) onPinClickRef.current(pin);
        // Scroll panel into view
        setTimeout(() => {
          const panel = document.querySelector("[data-trace-panel]");
          if (panel) panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 100);
      });
      marker.addTo(layer);
    });
  }, [dispatchPins]);

  return (
    <div style={{ position: "relative", height }}>
      <div
        ref={mapRef}
        style={{
          height: "100%", width: "100%", borderRadius: 8, overflow: "hidden",
          border: "1px solid var(--border)",
        }}
      />
      {/* Overlay content (panels, floating buttons) */}
      {children}
      {/* Tile mode toggle - left side below action buttons */}
      <div style={{
        position: "absolute", top: 160, left: 8, zIndex: 1000,
        display: "flex", flexDirection: "column", gap: 2, background: "var(--surface)",
        borderRadius: 6, padding: 2, backdropFilter: "blur(8px)",
        border: "1px solid var(--border)",
      }}>
        {(["satellite", "dark", "light"] as TileMode[]).map((m) => (
          <button key={m} onClick={() => switchTiles(m)}
            style={{
              padding: "4px 10px", fontSize: 10, border: "none", borderRadius: 4,
              cursor: "pointer", fontWeight: tileMode === m ? 700 : 400,
              background: tileMode === m ? "var(--accent)" : "transparent",
              color: tileMode === m ? "var(--accent-text)" : "var(--text-muted)",
            }}
          >{m}</button>
        ))}
      </div>
    </div>
  );
}

// weight (0-1) -> color gradient (blue -> yellow -> red)
function weightToColor(w: number): string {
  if (w < 0.33) return "#3498db";
  if (w < 0.66) return "#f1c40f";
  return "#e74c3c";
}

// re-export the simple MapView for backward compat
export { IntelMap as MapView };
export type { MapMarker, DispatchPin };
