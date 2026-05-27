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

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

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
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<any>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [wipeConfirm, setWipeConfirm] = useState(false);
  const [mode, setMode] = useState<"report" | "check">("report");
  const [checkPlate, setCheckPlate] = useState("");
  const [checkState, setCheckState] = useState("CA");
  const [checkResult, setCheckResult] = useState<any>(null);
  const [checking, setChecking] = useState(false);
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [hasCarApi, setHasCarApi] = useState(false);
  const [plateSuggestions, setPlateSuggestions] = useState<any[]>([]);
  const [rapidSending, setRapidSending] = useState(false);
  const [rapidDone, setRapidDone] = useState(false);
  const suggestTimer = useRef<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Rapid incident capture — one tap, auto-GPS, no form
  const handleRapidCapture = async () => {
    setRapidSending(true);
    try {
      let lat: number | undefined;
      let lng: number | undefined;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch { /* GPS not available */ }
      await api.rapidCapture({ lat, lng, description: "Rapid capture from field reporter." });
      setRapidDone(true);
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    } catch {}
    setRapidSending(false);
  };

  // Debounced plate auto-suggest
  const handlePlateInput = (val: string) => {
    const upper = val.toUpperCase();
    setDraft((d) => ({ ...d, plate: upper }));
    setPlateSuggestions([]);
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (upper.length >= 3) {
      suggestTimer.current = setTimeout(async () => {
        try {
          const res = await fetch(`${(import.meta as any).env?.VITE_API_URL || "/api/v1"}/vehicles/search-plates?q=${encodeURIComponent(upper)}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem("trace_token") || ""}` },
          });
          if (res.ok) setPlateSuggestions(await res.json());
        } catch {}
      }, 300);
    }
  };

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

    // Convert photos to base64
    const photoPayloads: { data: string; mimeType: string; lat?: number; lng?: number }[] = [];
    for (const file of draft.photos) {
      try {
        const buffer = await file.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        photoPayloads.push({ data: base64, mimeType: file.type || "image/jpeg" });
      } catch {}
    }

    const payload = {
      lat: draft.lat || 0, lng: draft.lng || 0,
      observedAt: jitteredTime.toISOString(),
      plate: draft.plate || undefined,
      vehicleDescription: draft.vehicleDescription || undefined,
      activityDescription: draft.activityDescription || undefined,
      direction: draft.direction || undefined,
      notes: draft.notes || undefined,
      photos: photoPayloads.length > 0 ? photoPayloads : undefined,
    };
    try {
      const result = await api.submitSighting(payload) as any;
      setSubmittedId(result?.id || null);
      setSubmitted(true);
      // Vibrate on success
      if (navigator.vibrate) navigator.vibrate(100);
      // Poll for feedback
      if (result?.id) {
        const pollInterval = setInterval(async () => {
          try {
            const fbList = await api.getMyFeedback() as any[];
            const fb = fbList.find((f: any) => f.sightingId === result.id);
            if (fb) { setFeedback(fb); clearInterval(pollInterval); }
          } catch {}
        }, 3000);
        // Stop polling after 60s
        setTimeout(() => clearInterval(pollInterval), 60000);
      }
    } catch {
      await enqueue({ id: crypto.randomUUID(), payload, photos: [], queuedAt: new Date().toISOString() });
      setSubmitted(true);
    }
    setSubmitting(false);
    // Auto-reset after 30 seconds
    setTimeout(() => { setDraft(emptyDraft()); setSubmitted(false); setSubmittedId(null); setFeedback(null); }, 30000);
  };

  const handlePlateCheck = async () => {
    if (!checkPlate.trim() || checkPlate.length < 2) return;
    setChecking(true);
    setCheckResult(null);
    try {
      const result = await api.plateLookup(checkPlate.trim(), checkState);
      setCheckResult(result);
    } catch { setCheckResult({ status: "not_found", message: "Lookup failed. Try again." }); }
    setChecking(false);
  };

  // Auto-lookup when plate is entered in report mode (Tier 1 only, no API cost)
  const autoLookupTimer = useRef<any>(null);
  const handleReportPlateBlur = () => {
    if (draft.plate.length >= 3) {
      if (autoLookupTimer.current) clearTimeout(autoLookupTimer.current);
      autoLookupTimer.current = setTimeout(async () => {
        try {
          const result = await api.plateLookup(draft.plate);
          setLookupResult(result);
        } catch { setLookupResult(null); }
      }, 500);
    }
  };

  if (submitted) {
    return (
      <div style={{ padding: "var(--sp-4)" }}>
        <div class="card" style={{ padding: "var(--sp-6)", textAlign: "center" }}>
          <div style={{ color: "var(--success)", marginBottom: "var(--sp-3)" }}>
            <Icon name="check" size={32} />
          </div>
          <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 600, marginBottom: "var(--sp-2)" }}>Sighting Submitted</h3>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: "var(--sp-4)" }}>
            Your report is being reviewed by dispatch. Status updates appear below.
          </p>

          {/* Live status */}
          <div style={{ textAlign: "left", fontSize: "var(--text-sm)" }}>
            <StatusRow done label="Submitted - dispatch received your report" />
            <StatusRow done={feedback !== null} pending={feedback === null} label={feedback ? "Plate checked" : "Waiting for dispatch to review..."} />
            {feedback?.feedbackType === "confirmed" && (
              <StatusRow done label="Confirmed - patrollers dispatched to the location" color="var(--success)" />
            )}
            {feedback?.feedbackType === "dismissed" && (
              <StatusRow done label={feedback.message || "Not in the database. No action needed."} color="var(--text-muted)" />
            )}
          </div>

          <button onClick={() => { setDraft(emptyDraft()); setSubmitted(false); setSubmittedId(null); setFeedback(null); }}
            class="btn btn-secondary btn-full" style={{ marginTop: "var(--sp-4)" }}>
            Report Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
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
            <div style={{ color: "var(--danger)", marginBottom: "var(--sp-3)" }}><Icon name="alert-triangle" size={32} /></div>
            <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--danger)", marginBottom: "var(--sp-2)" }}>Wipe all data?</h3>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-sec)", marginBottom: "var(--sp-5)", lineHeight: "var(--leading-relaxed)" }}>
              This will permanently destroy all TRACE data on this device. It cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "var(--sp-3)" }}>
              <button class="btn btn-secondary" style={{ flex: 1 }} onClick={() => setWipeConfirm(false)}>Cancel</button>
              <button class="btn btn-danger" style={{ flex: 1 }} onClick={() => panic()}><Icon name="x" size={14} /> Wipe Now</button>
            </div>
          </div>
        </div>
      )}

      {/* Header with emergency wipe */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-5)" }}>
        <h1 class="page-title" style={{ marginBottom: 0 }}>{mode === "report" ? "Report Sighting" : "Check Plate"}</h1>
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

      {/* Mode toggle */}
      {/* Rapid incident capture button */}
      {!rapidDone && (
        <button onClick={handleRapidCapture} disabled={rapidSending}
          style={{
            width: "100%", padding: "var(--sp-3)", borderRadius: "var(--radius)",
            fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer",
            background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.3)",
            color: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center",
            gap: "8px", marginBottom: "var(--sp-3)", minHeight: 44,
            opacity: rapidSending ? 0.6 : 1,
          }}>
          <Icon name="alert-octagon" size={16} /> {rapidSending ? "Filing..." : "Report Incident"}
        </button>
      )}
      {rapidDone && (
        <div style={{
          padding: "var(--sp-3)", borderRadius: "var(--radius)", marginBottom: "var(--sp-3)",
          background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)",
          fontSize: "var(--text-xs)", color: "var(--text-sec)", textAlign: "center",
        }}>
          Incident filed. Add details from the operator console, or add evidence from History.
          <button onClick={() => setRapidDone(false)} style={{ display: "block", margin: "8px auto 0", color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontSize: "var(--text-xs)" }}>
            Dismiss
          </button>
        </div>
      )}
      <div style={{ marginBottom: "var(--sp-4)" }}>
        <div style={{ display: "flex", gap: "var(--sp-2)", marginBottom: "var(--sp-2)" }}>
          <button onClick={() => { setMode("report"); setCheckResult(null); }}
            style={{
              flex: 1, padding: "var(--sp-2)", borderRadius: "var(--radius)",
              fontSize: "var(--text-sm)", fontWeight: 500, cursor: "pointer", transition: "all 150ms",
              background: mode === "report" ? "var(--accent)" : "var(--surface)",
              color: mode === "report" ? "var(--accent-text)" : "var(--text-sec)",
              border: mode === "report" ? "1px solid var(--accent)" : "1px solid var(--border)",
            }}>
            Report
          </button>
          <button onClick={() => setMode("check")}
            style={{
              flex: 1, padding: "var(--sp-2)", borderRadius: "var(--radius)",
              fontSize: "var(--text-sm)", fontWeight: 500, cursor: "pointer", transition: "all 150ms",
              background: mode === "check" ? "var(--accent)" : "var(--surface)",
              color: mode === "check" ? "var(--accent-text)" : "var(--text-sec)",
              border: mode === "check" ? "1px solid var(--accent)" : "1px solid var(--border)",
            }}>
            Check Plate
          </button>
        </div>
        <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
          {mode === "report"
            ? "Submit a sighting with location, plate, and details."
            : "Look up a plate before deciding whether to report."
          }
        </p>
      </div>

      {/* PLATE CHECK MODE */}
      {mode === "check" && (
        <div>
          <div style={{ display: "flex", gap: "var(--sp-2)", marginBottom: "var(--sp-4)" }}>
            <div style={{ flex: 1 }}>
              <label class="section-label" for="check-plate">Plate</label>
              <input id="check-plate" placeholder="ABC 1234" value={checkPlate}
                onInput={(e) => setCheckPlate((e.target as HTMLInputElement).value.toUpperCase())}
                onKeyDown={(e) => { if ((e as KeyboardEvent).key === "Enter") handlePlateCheck(); }}
                class="input input-plate"
                autoFocus
              />
            </div>
            <div style={{ width: 80 }}>
              <label class="section-label" for="check-state">State</label>
              <select id="check-state" value={checkState}
                onChange={(e) => setCheckState((e.target as HTMLSelectElement).value)}
                class="input" style={{ padding: "10px 6px", textAlign: "center" }}>
                {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <button onClick={handlePlateCheck} disabled={checking || checkPlate.length < 2}
            class="btn btn-primary btn-full" style={{ marginBottom: "var(--sp-4)" }}>
            {checking ? "Checking..." : "Look Up Plate"}
          </button>

          {/* Result: TRACKED (Tier 1 match) */}
          {checkResult && checkResult.status === "tracked" && (
            <div class="card" style={{
              padding: "var(--sp-4)",
              border: "1px solid rgba(217,119,6,0.4)",
              background: "rgba(217,119,6,0.06)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", marginBottom: "var(--sp-2)" }}>
                <span style={{
                  fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                  background: "rgba(217,119,6,0.15)", color: "#D97706",
                }}>TRACKED</span>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: "0.1em" }}>{checkResult.plate}</span>
              </div>
              {checkResult.description && (
                <p style={{ fontSize: "var(--text-sm)", color: "var(--text)", fontWeight: 500 }}>{checkResult.description}</p>
              )}
              {checkResult.tag && (
                <span style={{
                  display: "inline-block", fontSize: "10px", fontWeight: 600, padding: "2px 8px",
                  borderRadius: 4, background: "var(--accent-soft)", color: "var(--accent)",
                  marginTop: "var(--sp-1)",
                }}>{checkResult.tag}</span>
              )}
              {checkResult.suspicionLevel && (
                <p style={{ fontSize: "var(--text-xs)", color: checkResult.suspicionColor || "var(--text-muted)", marginTop: "var(--sp-1)" }}>
                  {checkResult.suspicionLevel}
                </p>
              )}
              <button onClick={() => {
                setDraft((d) => ({ ...d, plate: checkResult.plate || checkPlate }));
                setMode("report"); setCheckResult(null);
              }} class="btn btn-primary btn-full" style={{ marginTop: "var(--sp-3)" }}>
                Submit Full Report
              </button>
            </div>
          )}

          {/* Result: FOUND (Tier 2 CarAPI match) */}
          {checkResult && checkResult.status === "found" && (
            <div class="card" style={{ padding: "var(--sp-4)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", marginBottom: "var(--sp-2)" }}>
                <span style={{
                  fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                  background: "var(--accent-soft)", color: "var(--accent)",
                }}>ON RECORD</span>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: "0.1em" }}>{checkResult.plate}</span>
              </div>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--text)" }}>{checkResult.description}</p>
              {checkResult.bodyType && (
                <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: "var(--sp-1)" }}>{checkResult.bodyType}</p>
              )}
              <button onClick={() => {
                setDraft((d) => ({ ...d, plate: checkResult.plate || checkPlate }));
                setMode("report"); setCheckResult(null);
              }} class="btn btn-secondary btn-full" style={{ marginTop: "var(--sp-3)" }}>
                Report this vehicle
              </button>
            </div>
          )}

          {/* Result: NOT FOUND */}
          {checkResult && checkResult.status === "not_found" && (
            <div class="card" style={{ padding: "var(--sp-4)", textAlign: "center" }}>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                {checkResult.message || "No record found."}
              </p>
              <button onClick={() => {
                setDraft((d) => ({ ...d, plate: checkPlate }));
                setMode("report"); setCheckResult(null);
              }} class="btn btn-secondary" style={{ marginTop: "var(--sp-3)", fontSize: "var(--text-xs)" }}>
                Report anyway
              </button>
            </div>
          )}
        </div>
      )}

      {/* REPORT MODE */}
      {mode === "report" && (<div>

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

      {/* License Plate with auto-lookup */}
      {lookupResult && lookupResult.status === "tracked" && (
        <div class="card" style={{
          padding: "var(--sp-3)", marginBottom: "var(--sp-3)",
          border: "1px solid rgba(217,119,6,0.4)",
          background: "rgba(217,119,6,0.06)",
          fontSize: "var(--text-xs)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
            <span style={{
              fontSize: "9px", fontWeight: 700, padding: "1px 6px", borderRadius: 3,
              background: "rgba(217,119,6,0.15)", color: "#D97706",
            }}>TRACKED</span>
            <span style={{ fontWeight: 500 }}>{lookupResult.description || lookupResult.plate}</span>
            {lookupResult.tag && (
              <span style={{ fontSize: "9px", padding: "1px 6px", borderRadius: 3, background: "var(--accent-soft)", color: "var(--accent)" }}>{lookupResult.tag}</span>
            )}
          </div>
        </div>
      )}
      {lookupResult && lookupResult.status === "found" && (
        <div class="card" style={{
          padding: "var(--sp-3)", marginBottom: "var(--sp-3)",
          fontSize: "var(--text-xs)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
            <span style={{
              fontSize: "9px", fontWeight: 700, padding: "1px 6px", borderRadius: 3,
              background: "var(--accent-soft)", color: "var(--accent)",
            }}>ON RECORD</span>
            <span style={{ fontWeight: 500 }}>{lookupResult.description || lookupResult.plate}</span>
          </div>
        </div>
      )}
      <div style={{ marginBottom: "var(--sp-4)", position: "relative" }}>
        <label class="section-label" for="plate">License Plate</label>
        <input id="plate" placeholder="ABC 1234" value={draft.plate}
          onInput={(e) => handlePlateInput((e.target as HTMLInputElement).value)}
          onBlur={handleReportPlateBlur}
          onFocus={() => { if (draft.plate.length >= 3) handlePlateInput(draft.plate); }}
          class="input input-plate"
        />
        {plateSuggestions.length > 0 && (
          <div style={{
            position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--radius)", marginTop: 2, overflow: "hidden",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          }}>
            {plateSuggestions.map((s: any) => (
              <button key={s.id}
                onClick={() => { setDraft((d) => ({ ...d, plate: s.plate })); setPlateSuggestions([]); }}
                style={{
                  display: "flex", alignItems: "center", gap: "var(--sp-2)",
                  padding: "var(--sp-2) var(--sp-3)", width: "100%",
                  background: "none", border: "none", borderBottom: "1px solid var(--border)",
                  cursor: "pointer", textAlign: "left",
                  color: "var(--text)", fontSize: "var(--text-sm)",
                }}>
                <span style={{
                  fontSize: "8px", fontWeight: 700, padding: "1px 6px", borderRadius: 3,
                  background: "rgba(220,38,38,0.15)", color: "#DC2626",
                }}>MATCH</span>
                <span style={{ fontFamily: "monospace", fontWeight: 600, letterSpacing: "0.1em" }}>{s.plate}</span>
                {s.color && <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{s.color} {s.make} {s.model}</span>}
              </button>
            ))}
          </div>
        )}
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
        <label class="section-label">Which way was the vehicle heading?</label>
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
      </div>)}
    </div>
  );
}

function StatusRow({ done, pending, label, color }: { done?: boolean; pending?: boolean; label: string; color?: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "var(--sp-2)",
      padding: "var(--sp-2) 0",
      color: color || (done ? "var(--text)" : "var(--text-muted)"),
    }}>
      {done && <span style={{ color: color || "var(--success)" }}>✓</span>}
      {pending && <span style={{ opacity: 0.5 }}>⏳</span>}
      {!done && !pending && <span style={{ opacity: 0.3 }}>○</span>}
      <span>{label}</span>
    </div>
  );
}
