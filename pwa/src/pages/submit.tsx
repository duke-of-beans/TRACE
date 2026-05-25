/**
 * TRACE PWA — Submit Sighting
 *
 * THREE TAPS: Camera → Review → Submit
 * Clean form design. Clear labels. Large touch targets.
 */
import { useState, useRef } from "preact/hooks";
import { api } from "../lib/api.js";
import { enqueue } from "../lib/queue.js";
import { applyJitter } from "../lib/jitter.js";
import { DirectCamera } from "../components/camera.js";
import { Icon } from "../components/icon.js";

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

const DIRECTIONS = [
  { key: "N",  label: "North",    icon: "arrow-n" },
  { key: "NE", label: "NE",       icon: "arrow-ne" },
  { key: "E",  label: "East",     icon: "arrow-e" },
  { key: "SE", label: "SE",       icon: "arrow-se" },
  { key: "S",  label: "South",    icon: "arrow-s" },
  { key: "SW", label: "SW",       icon: "arrow-sw" },
  { key: "W",  label: "West",     icon: "arrow-w" },
  { key: "NW", label: "NW",       icon: "arrow-nw" },
];

const emptyDraft = (): SightingDraft => ({
  photos: [], photoUrls: [], lat: null, lng: null,
  observedAt: new Date().toISOString().slice(0, 16),
  plate: "", vehicleDescription: "", activityDescription: "",
  direction: "", notes: "",
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
    let lat = draft.lat;
    let lng = draft.lng;
    if (!lat && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {}
    }
    setDraft((d) => ({ ...d, photos: [...d.photos, ...files], photoUrls: [...d.photoUrls, ...urls], lat, lng }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const jitteredTime = applyJitter(new Date(draft.observedAt));
    const payload = {
      lat: draft.lat || 0, lng: draft.lng || 0,
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
      await enqueue({ id: crypto.randomUUID(), payload, photos: [], queuedAt: new Date().toISOString() });
      setSubmitted(true);
    }
    setSubmitting(false);
    setTimeout(() => { setDraft(emptyDraft()); setSubmitted(false); }, 2000);
  };

  if (submitted) {
    return (
      <div class="auth-screen">
        <div class="auth-card">
          <Icon name="check-circle" size={48} class="text-success" />
          <p style={{ marginTop: "var(--sp-4)", color: "var(--text-sec)" }}>Sighting recorded</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 class="page-title">Report Sighting</h1>

      {/* Direct Camera */}
      {showCamera && (
        <DirectCamera
          onCapture={(result) => {
            setDraft((d) => ({
              ...d,
              photos: [...d.photos, new File([result.blob], `capture-${Date.now()}.jpg`)],
              photoUrls: [...d.photoUrls, result.url],
              lat: result.lat || d.lat, lng: result.lng || d.lng,
            }));
            setShowCamera(false);
          }}
          onClose={() => setShowCamera(false)}
        />
      )}

      {/* Photo capture */}
      <input ref={fileRef} type="file" accept="image/*" multiple onChange={handlePhotos} style={{ display: "none" }} />
      <div class="capture-area">
        <button class="capture-btn" onClick={() => setShowCamera(true)}>
          <Icon name="camera" size={20} />
          {draft.photos.length > 0 ? `${draft.photos.length} photo(s)` : "Take Photo"}
        </button>
        <button class="capture-fallback" onClick={() => fileRef.current?.click()} aria-label="Select from files">
          Files
        </button>
      </div>

      {/* Photo thumbnails */}
      {draft.photoUrls.length > 0 && (
        <div class="photo-strip">
          {draft.photoUrls.map((url, i) => (
            <img key={i} src={url} alt={`Photo ${i + 1}`} />
          ))}
        </div>
      )}

      {/* License Plate */}
      <div style={{ marginBottom: "var(--sp-4)" }}>
        <label class="section-label" for="plate">License Plate</label>
        <input id="plate" placeholder="ABC 1234" value={draft.plate}
          onInput={(e) => setDraft((d) => ({ ...d, plate: (e.target as HTMLInputElement).value.toUpperCase() }))}
          class="input input-plate"
        />
      </div>

      {/* Vehicle Description */}
      <div style={{ marginBottom: "var(--sp-4)" }}>
        <label class="section-label" for="vehicle-desc">Vehicle Description</label>
        <input id="vehicle-desc" placeholder="e.g. Red 2019 Honda Civic, tinted windows" value={draft.vehicleDescription}
          onInput={(e) => setDraft((d) => ({ ...d, vehicleDescription: (e.target as HTMLInputElement).value }))}
          class="input"
        />
      </div>

      {/* Activity */}
      <div style={{ marginBottom: "var(--sp-4)" }}>
        <label class="section-label" for="activity">What were they doing?</label>
        <input id="activity" placeholder="e.g. Circling the block, parked and watching" value={draft.activityDescription}
          onInput={(e) => setDraft((d) => ({ ...d, activityDescription: (e.target as HTMLInputElement).value }))}
          class="input"
        />
      </div>

      {/* Direction of Travel */}
      <div style={{ marginBottom: "var(--sp-4)" }}>
        <label class="section-label">Direction of Travel</label>
        <div class="direction-grid">
          {DIRECTIONS.map((dir) => (
            <button key={dir.key}
              class={`direction-btn ${draft.direction === dir.key ? "selected" : ""}`}
              onClick={() => setDraft((d) => ({ ...d, direction: d.direction === dir.key ? "" : dir.key }))}
              aria-label={`Direction: ${dir.label}`}
              aria-pressed={draft.direction === dir.key}
            >
              <Icon name={dir.icon} size={16} />
              {dir.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div style={{ marginBottom: "var(--sp-4)" }}>
        <label class="section-label" for="notes">Additional Notes <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(optional)</span></label>
        <textarea id="notes" placeholder="Anything else worth noting" value={draft.notes}
          onInput={(e) => setDraft((d) => ({ ...d, notes: (e.target as HTMLTextAreaElement).value }))}
          class="input"
        />
      </div>

      {/* Location */}
      {draft.lat && (
        <div class="location-tag">
          <Icon name="map-pin" size={14} />
          {draft.lat.toFixed(4)}, {draft.lng?.toFixed(4)}
        </div>
      )}

      {/* Submit */}
      <button onClick={handleSubmit} disabled={submitting} class="btn btn-primary btn-full btn-lg">
        <Icon name="send" size={18} />
        {submitting ? "Sending..." : "Submit Sighting"}
      </button>
    </div>
  );
}
