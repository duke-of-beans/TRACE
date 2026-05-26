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
};

type IntelMapProps = {
  markers?: MapMarker[];
  highlightedMarkers?: MapMarker[];
  heatmapData?: HeatmapPoint[];
  corridors?: { vehicleId: string; color: string; segments: CorridorSegment[] }[];
  coOccurrences?: CoOccurrence[];
  center?: [number, number];
  zoom?: number;
  height?: string;
};

// layer group refs for clean updates
type LayerRefs = {
  markers: L.LayerGroup;
  highlighted: L.LayerGroup;
  heatmap: L.LayerGroup;
  corridors: L.LayerGroup;
  coOccurrences: L.LayerGroup;
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
  center = [34.0, -118.5],
  zoom = 12,
  height = "500px",
}: IntelMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<L.Map | null>(null);
  const layersRef = useRef<LayerRefs | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const [tileMode, setTileMode] = useState<TileMode>("satellite");

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

    // default tiles
    const t = TILES.satellite;
    tileRef.current = L.tileLayer(t.url, { attribution: t.attr, maxZoom: 19 }).addTo(map);

    const layers: LayerRefs = {
      markers: L.layerGroup().addTo(map),
      highlighted: L.layerGroup().addTo(map),
      heatmap: L.layerGroup().addTo(map),
      corridors: L.layerGroup().addTo(map),
      coOccurrences: L.layerGroup().addTo(map),
    };

    // layer control
    L.control.layers({}, {
      "Sightings": layers.markers,
      "Highlighted": layers.highlighted,
      "Heatmap": layers.heatmap,
      "Corridors": layers.corridors,
      "Co-occurrence": layers.coOccurrences,
    }, { collapsed: false, position: "topright" }).addTo(map);

    leafletRef.current = map;
    layersRef.current = layers;

    return () => { map.remove(); leafletRef.current = null; };
  }, []);

  // --- Markers ---
  useEffect(() => {
    const layer = layersRef.current?.markers;
    if (!layer) return;
    layer.clearLayers();

    markers.forEach((m) => {
      L.circleMarker([m.lat, m.lng], {
        radius: 7,
        fillColor: m.color || "#4fc3f7",
        color: "#fff", weight: 1.5, opacity: 1, fillOpacity: 0.85,
      })
        .bindPopup(m.popup || `${m.lat.toFixed(4)}, ${m.lng.toFixed(4)}`)
        .bindTooltip(m.label || "", { permanent: false })
        .addTo(layer);
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
      L.circleMarker([p.lat, p.lng], {
        radius: 15 + p.weight * 20,
        fillColor: weightToColor(p.weight),
        color: "transparent",
        fillOpacity: 0.3 + p.weight * 0.4,
      }).addTo(layer);
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

  return (
    <div style={{ position: "relative" }}>
      <div
        ref={mapRef}
        style={{
          height, width: "100%", borderRadius: 8, overflow: "hidden",
          border: "1px solid #2a2a3e",
        }}
      />
      {/* Tile mode toggle */}
      <div style={{
        position: "absolute", bottom: 8, left: 8, zIndex: 1000,
        display: "flex", gap: 2, background: "rgba(26,26,46,0.9)",
        borderRadius: 6, padding: 2,
      }}>
        {(["light", "dark", "satellite"] as TileMode[]).map((m) => (
          <button key={m} onClick={() => switchTiles(m)}
            style={{
              padding: "4px 10px", fontSize: 11, border: "none", borderRadius: 4,
              cursor: "pointer", fontWeight: tileMode === m ? 700 : 400,
              background: tileMode === m ? "#4fc3f7" : "transparent",
              color: tileMode === m ? "#0f0f1a" : "#888",
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
