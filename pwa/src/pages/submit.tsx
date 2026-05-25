/**
 * TRACE PWA — Submit Sighting
 *
 * THREE TAPS: Camera -> Review -> Submit
 * Must be faster than typing into a group chat.
 *
 * Flow:
 * 1. Tap camera button -> capture/select photo(s)
 * 2. Auto-populate GPS + timestamp from EXIF
 * 3. Add plate, description, notes -> Submit
 */
import { useState, useRef } from "preact/hooks";
import { api } from "../lib/api.js";
import { enqueue } from "../lib/queue.js";
import { applyJitter } from "../lib/jitter.js";
import { DirectCamera } from "../components/camera.js";

type SightingDraft = {
  photos: File[];
  photoUrls: string[];
  lat: number | null;
  lng: number | null;
  observedAt: string;
  plate: string;
  vehicleDescription: string;
  activityDescription: string;
  direction: string;
  notes: string;
};

const DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const DIRECTION_LABELS: Record<string, string> = {
  N: "↑ North", NE: "↗ NE", E: "→ East", SE: "↘ SE",
  S: "↓ South", SW: "↙ SW", W: "← West", NW: "↖ NW",
};

const emptyDraft = (): SightingDraft => ({
  photos: [],
  photoUrls: [],
  lat: null,
  lng: null,
  observedAt: new Date().toISOString().slice(0, 16),
  plate: "",
  vehicleDescription: "",
  activityDescription: "",
  direction: "",
  notes: "",
});

export function Submit() {
  const [draft, setDraft] = useState<SightingDraft>(emptyDraft());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhotos = async (e: Event) => {
    const files = Array.from((e.target as HTMLInputElement).files || []);
    if (files.length === 0) return;

    const urls = files.map((f) => URL.createObjectURL(f));

    // try to get GPS from browser geolocation (faster than EXIF parsing on mobile)
    let lat = draft.lat;
    let lng = draft.lng;
    if (!lat && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
          })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch { /* geolocation unavailable, user can set manually */ }
    }

    setDraft((d) => ({
      ...d,
      photos: [...d.photos, ...files],
      photoUrls: [...d.photoUrls, ...urls],
      lat,
      lng,
    }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);

    const jitteredTime = applyJitter(new Date(draft.observedAt));

    const payload = {
      lat: draft.lat || 0,
      lng: draft.lng || 0,
      observedAt: jitteredTime.toISOString(),
      plate: draft.plate || undefined,
      vehicleDescription: draft.vehicleDescription || undefined,
      activityDescription: draft.activityDescription || undefined,
      direction: draft.direction || undefined,
      notes: draft.notes || undefined,
    };

    try {
      await api.submitSighting(payload);
      setSubmitted(true);
    } catch {
      // offline or server unreachable - encrypt and queue
      await enqueue({
        id: crypto.randomUUID(),
        payload,
        photos: [],
        queuedAt: new Date().toISOString(),
      });
      setSubmitted(true);
    }

    setSubmitting(false);
    setTimeout(() => {
      setDraft(emptyDraft());
      setSubmitted(false);
    }, 2000);
  };

  if (submitted) {
    return (
      <div style={{ textAlign: "center", marginTop: "30vh" }}>
        <div style={{ fontSize: 48 }}>✓</div>
        <p style={{ marginTop: 12, color: "#4fc3f7" }}>Sighting recorded</p>
      </div>
    );
  }

  const s = inputStyle;

  return (
    <div>
      <h2 style={{ fontSize: 20, marginBottom: 16 }}>Report Sighting</h2>

      {/* Direct Camera (no gallery copies) */}
      {showCamera && (
        <DirectCamera
          onCapture={(result) => {
            setDraft((d) => ({
              ...d,
              photos: [...d.photos, new File([result.blob], `capture-${Date.now()}.jpg`)],
              photoUrls: [...d.photoUrls, result.url],
              lat: result.lat || d.lat,
              lng: result.lng || d.lng,
            }));
            setShowCamera(false);
          }}
          onClose={() => setShowCamera(false)}
        />
      )}

      {/* Photo capture buttons */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handlePhotos}
        style={{ display: "none" }}
      />
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setShowCamera(true)}
          style={{
            flex: 2, padding: "16px", background: "#1a1a2e",
            border: "2px dashed #4fc3f7", borderRadius: 12,
            color: "#4fc3f7", fontSize: 15, cursor: "pointer",
          }}
        >
          📷 {draft.photos.length > 0 ? `${draft.photos.length} photo(s)` : "Camera"}
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          style={{
            flex: 1, padding: "16px", background: "#1a1a2e",
            border: "2px dashed #2a2a3e", borderRadius: 12,
            color: "#666", fontSize: 12, cursor: "pointer",
          }}
          title="⚠ File picker may save to gallery"
        >
          Files
        </button>
      </div>

      {/* Photo thumbnails */}
      {draft.photoUrls.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto" }}>
          {draft.photoUrls.map((url, i) => (
            <img key={i} src={url} style={{ height: 80, borderRadius: 8, objectFit: "cover" }} />
          ))}
        </div>
      )}

      {/* Plate - most important field */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>License Plate</label>
        <input placeholder="ABC 1234" value={draft.plate}
          onInput={(e) => setDraft((d) => ({ ...d, plate: (e.target as HTMLInputElement).value.toUpperCase() }))}
          style={{ ...s, fontSize: 20, fontWeight: 700, letterSpacing: 2, textAlign: "center", marginBottom: 0 }}
        />
      </div>

      {/* Vehicle description */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Vehicle Description</label>
        <input placeholder="e.g. Red 2019 Honda Civic, tinted windows" value={draft.vehicleDescription}
          onInput={(e) => setDraft((d) => ({ ...d, vehicleDescription: (e.target as HTMLInputElement).value }))}
          style={{ ...s, marginBottom: 0 }}
        />
      </div>

      {/* Activity */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>What were they doing?</label>
        <input placeholder="e.g. Circling the block, parked and watching" value={draft.activityDescription}
          onInput={(e) => setDraft((d) => ({ ...d, activityDescription: (e.target as HTMLInputElement).value }))}
          style={{ ...s, marginBottom: 0 }}
        />
      </div>

      {/* Direction */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Direction of Travel</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {DIRECTIONS.map((dir) => (
            <button key={dir} onClick={() => setDraft((d) => ({ ...d, direction: d.direction === dir ? "" : dir }))}
              style={{
                padding: "8px 14px", borderRadius: 6, border: "none", cursor: "pointer",
                background: draft.direction === dir ? "#4fc3f7" : "#1a1a2e",
                color: draft.direction === dir ? "#0f0f1a" : "#888",
                fontSize: 13, fontWeight: 600,
              }}
            >{DIRECTION_LABELS[dir]}</button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Additional Notes <span style={{ fontWeight: 400, color: "#555" }}>(optional)</span></label>
        <textarea placeholder="Anything else worth noting" value={draft.notes}
          onInput={(e) => setDraft((d) => ({ ...d, notes: (e.target as HTMLTextAreaElement).value }))}
          style={{ ...s, minHeight: 60, resize: "vertical", marginBottom: 0 }}
        />
      </div>

      {/* Location indicator */}
      {draft.lat && (
        <p style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>
          📍 {draft.lat.toFixed(4)}, {draft.lng?.toFixed(4)}
        </p>
      )}

      {/* Submit - TAP 3 */}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        style={{
          width: "100%", padding: 16, marginTop: 8,
          background: submitting ? "#333" : "#4fc3f7",
          color: "#0f0f1a", border: "none", borderRadius: 12,
          fontSize: 18, fontWeight: 700, cursor: submitting ? "default" : "pointer",
        }}
      >
        {submitting ? "Sending..." : "Submit Sighting"}
      </button>
    </div>
  );
}

const inputStyle: Record<string, string | number> = {
  width: "100%", padding: "12px 16px", marginBottom: 12,
  background: "#1a1a2e", border: "1px solid #2a2a3e",
  borderRadius: 8, color: "#e0e0e0", fontSize: 15,
};

const labelStyle: Record<string, string | number> = {
  display: "block", fontSize: 12, color: "#888",
  marginBottom: 6, fontWeight: 600,
  textTransform: "uppercase", letterSpacing: 0.5,
};
