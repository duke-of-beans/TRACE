/**
 * TRACE Operator — Map Component
 *
 * Leaflet.js map for sighting visualization.
 * Shows: sighting locations, vehicle corridors, actor territories.
 * Uses OpenStreetMap tiles (self-hosted in production, CDN for dev).
 */
import { useEffect, useRef } from "react";
import L from "leaflet";

type MapMarker = {
  lat: number;
  lng: number;
  label?: string;
  color?: string;
  popup?: string;
};

type MapViewProps = {
  markers: MapMarker[];
  center?: [number, number];
  zoom?: number;
  height?: string;
  showHeatmap?: boolean;
};

export function MapView({
  markers,
  center = [34.0, -118.5], // default: LA area
  zoom = 12,
  height = "400px",
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || leafletRef.current) return;

    const map = L.map(mapRef.current).setView(center, zoom);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    leafletRef.current = map;

    return () => {
      map.remove();
      leafletRef.current = null;
    };
  }, []);

  // update markers when data changes
  useEffect(() => {
    const map = leafletRef.current;
    if (!map) return;

    // clear existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.CircleMarker) map.removeLayer(layer);
    });

    // add new markers
    markers.forEach((m) => {
      const circle = L.circleMarker([m.lat, m.lng], {
        radius: 8,
        fillColor: m.color || "#4fc3f7",
        color: "#fff",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8,
      }).addTo(map);

      if (m.popup) {
        circle.bindPopup(m.popup);
      }
      if (m.label) {
        circle.bindTooltip(m.label, { permanent: false });
      }
    });

    // fit bounds if markers exist
    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [markers]);

  return (
    <div
      ref={mapRef}
      style={{ height, width: "100%", borderRadius: 8, overflow: "hidden" }}
    />
  );
}
