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
import { scrubPhoto } from "../lib/photo-scrub.js";
import { Icon } from "../components/icon.js";
import { panic } from "../lib/panic.js";

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
  const [wipeConfirm, setWipeConfirm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhotos = async (e: Event) => {
    const rawFiles = Array.from((e.target as HTMLInputElement).files || []);
    if (rawFiles.length === 0) return;

    // Scrub EXIF metadata from uploaded files — strips camera make/model,
    // serial number, device ID, all MakerNote data. Extracts GPS first.
    const scrubbed: File[] = [];
    const urls: string[] = [];
    let lat = draft.lat;
    let lng = draft.lng;

    for (const file of rawFiles) {
      const { clean, meta } = await scrubPhoto(file);
      scrubbed.push(new File([clean], file.name, { type: "image/jpeg" }));
      urls.push(URL.createObjectURL(clean));
      // Use EXIF GPS if we don't have a location yet
      if (!lat && meta.lat) { lat = meta.lat; lng = meta.lng || null; }
    }

    // Fall back to device geolocation if no EXIF GPS
    if (!lat && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {}
    }
    setDraft((d) => ({ ...d, photos: [...d.photos, ...scrubbed], photoUrls: [...d.photoUrls, ...urls], lat, lng }));
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
      {/* Header with emergency wipe */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-5)" }}>
        <h1 class="page-title" style={{ marginBottom: 0 }}>Report Sighting</h1>
        <button
          onClick={() => setWipeConfirm(true)}
          aria-label="Emergency wipe"
          style={{
            background: "none", border: "1px solid var(--danger)",
            borderRadius: "var(--radius)", padding: "6px 10px",
            color: "var(--danger)", cursor: "pointer", display: "flex",
            alignItems: "center", gap: "4px", fontSize: "var(--text-xs)",
            fontWeight: 600, minHeight: 36,
          }}
        >
          <Icon name="alert-triangle" size={14} /> Wipe
        </button>
      </div>

      {/* Wipe confirmation overlay */}
      {wipeConfirm && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "var(--sp-4)",
        }} onClick={() => setWipeConfirm(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "var(--surface)", border: "1px solid var(--danger)",
            borderRadius: "var(--radius-lg)", padding: "var(--sp-6)",
            maxWidth: 340, width: "100%", textAlign: "center",
          }}>
            <div style={{ color: "var(--danger)", marginBottom: "var(--sp-3)" }}>
              <Icon name="alert-triangle" size={32} />
            </div>
            <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--danger)", marginBottom: "var(--sp-2)" }}>
              Wipe all data?
            </h3>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-sec)", marginBottom: "var(--sp-5)", lineHeight: "var(--leading-relaxed)" }}>
              This will permanently destroy all TRACE data on this device. It cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "var(--sp-3)" }}>
              <button class="btn btn-secondary" style={{ flex: 1 }} onClick={() => setWipeConfirm(false)}>
                Cancel
              </button>
              <button class="btn btn-danger" style={{ flex: 1 }} onClick={() => panic()}>
                <Icon name="x" size={14} /> Wipe Now
              </button>
            </div>
          </div>
        </div>
      )}

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
