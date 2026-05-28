/**
 * TRACE PWA — Submission History
 *
 * Two sub-tabs: Sightings | Alerts
 * Shows tags and operator responses from the feedback loop.
 * Reporter-to-reporter invisibility maintained.
 */
import { useState, useEffect } from "preact/hooks";
import { api, getToken } from "../lib/api.js";
import { getQueueCount, drainQueue } from "../lib/queue.js";
import { Icon } from "../components/icon.js";

const API_BASE = import.meta.env.VITE_API_URL || "/api/v1";

type SubTab = "sightings" | "alerts" | "burst";

type Sighting = {
  id: string;
  plate?: string;
  vehicleDescription?: string;
  activityDescription?: string;
  direction?: string;
  observedAt: string;
  submittedAt: string;
  operatorTag?: string;
  operatorResponse?: string;
  operatorRespondedAt?: string;
  lat: number;
  lng: number;
};

type HarassmentReport = {
  id: string;
  phoneNumber: string;
  incidentType: string;
  description?: string;
  occurredAt: string;
  status: string;
  operatorTag?: string;
  operatorResponse?: string;
  operatorRespondedAt?: string;
  createdAt: string;
};

export function History() {
  const [tab, setTab] = useState<SubTab>("sightings");
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [alerts, setAlerts] = useState<HarassmentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const loadHistory = async () => {
    setLoading(true);
    setError("");
    try {
      const [sData, aData] = await Promise.all([
        api.getMySightings().catch(() => []),
        api.getMyHarassmentReports().catch(() => []),
      ]);
      setSightings(Array.isArray(sData) ? (sData as Sighting[]) : []);
      setAlerts(Array.isArray(aData) ? (aData as HarassmentReport[]) : []);
    } catch {
      setError("Could not load history. Check connection.");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (getToken()) loadHistory();
    else setLoading(false);
    getQueueCount().then(setQueueCount);
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    const result = await drainQueue();
    setQueueCount(result.remaining);
    setSyncing(false);
    if (result.sent > 0) loadHistory();
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffH = (now.getTime() - d.getTime()) / 3600000;
    if (diffH < 1) return `${Math.round(diffH * 60)}m ago`;
    if (diffH < 24) return `${Math.round(diffH)}h ago`;
    if (diffH < 48) return "Yesterday";
    return d.toLocaleDateString();
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div>
      <h1 class="page-title">History</h1>

      {/* Sub-tabs */}
      {getToken() && (
        <div style={{ display: "flex", gap: 0, marginBottom: "var(--sp-4)", borderBottom: "1px solid var(--border)" }}>
          <button onClick={() => setTab("sightings")} style={{
            padding: "var(--sp-2) var(--sp-4)", fontSize: "var(--text-sm)", fontWeight: 500,
            background: "none", border: "none", cursor: "pointer",
            color: tab === "sightings" ? "var(--accent)" : "var(--text-muted)",
            borderBottom: tab === "sightings" ? "2px solid var(--accent)" : "2px solid transparent",
            marginBottom: -1,
          }}>Sightings</button>
          <button onClick={() => setTab("alerts")} style={{
            padding: "var(--sp-2) var(--sp-4)", fontSize: "var(--text-sm)", fontWeight: 500,
            background: "none", border: "none", cursor: "pointer",
            color: tab === "alerts" ? "var(--accent)" : "var(--text-muted)",
            borderBottom: tab === "alerts" ? "2px solid var(--accent)" : "2px solid transparent",
            marginBottom: -1,
          }}>
            Alerts
            {alerts.length > 0 && <span style={{ marginLeft: 4, fontSize: "10px", fontWeight: 700, padding: "1px 5px", borderRadius: 8, background: "var(--accent-soft)", color: "var(--accent)" }}>{alerts.length}</span>}
          </button>
          <button onClick={() => setTab("burst")} style={{
            padding: "var(--sp-2) var(--sp-4)", fontSize: "var(--text-sm)", fontWeight: 500,
            background: "none", border: "none", cursor: "pointer",
            color: tab === "burst" ? "var(--accent)" : "var(--text-muted)",
            borderBottom: tab === "burst" ? "2px solid var(--accent)" : "2px solid transparent",
            marginBottom: -1,
          }}>
            Burst
            {sightings.filter((s: any) => s.activityDescription?.includes("[Burst capture")).length > 0 && (
              <span style={{ marginLeft: 4, fontSize: "10px", fontWeight: 700, padding: "1px 5px", borderRadius: 8, background: "rgba(231,76,60,0.15)", color: "#e74c3c" }}>
                {sightings.filter((s: any) => s.activityDescription?.includes("[Burst capture")).length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Offline queue banner */}
      {queueCount > 0 && (
        <div class="card" style={{ marginBottom: "var(--sp-4)", borderColor: "var(--warning)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--warning)" }}>
                {queueCount} queued offline
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2 }}>
                Encrypted on device. Will sync when connected.
              </div>
            </div>
            <button
              class="btn btn-secondary"
              onClick={handleSync}
              disabled={syncing || !navigator.onLine}
              style={{ flexShrink: 0 }}
            >
              {syncing ? "Syncing..." : "Sync Now"}
            </button>
          </div>
        </div>
      )}

      {/* Not authenticated */}
      {!getToken() && (
        <div class="card" style={{ textAlign: "center", padding: "var(--sp-8) var(--sp-4)" }}>
          <div style={{ color: "var(--text-muted)", marginBottom: "var(--sp-3)" }}>
            <Icon name="clock" size={32} />
          </div>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-sec)" }}>
            Join a chapter to see your submission history.
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && getToken() && (
        <div style={{ textAlign: "center", padding: "var(--sp-8)", color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
          Loading submissions...
        </div>
      )}

      {/* Error */}
      {error && (
        <div class="card" style={{ textAlign: "center", padding: "var(--sp-6)" }}>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--danger)", marginBottom: "var(--sp-3)" }}>{error}</p>
          <button class="btn btn-secondary" onClick={loadHistory}>Retry</button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && getToken() && tab === "sightings" && sightings.length === 0 && (
        <div class="card" style={{ textAlign: "center", padding: "var(--sp-8) var(--sp-4)" }}>
          <div style={{ color: "var(--text-muted)", marginBottom: "var(--sp-3)" }}>
            <Icon name="send" size={32} />
          </div>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-sec)" }}>
            No sightings yet. Reports appear here after you submit them.
          </p>
        </div>
      )}
      {!loading && !error && getToken() && tab === "alerts" && alerts.length === 0 && (
        <div class="card" style={{ textAlign: "center", padding: "var(--sp-8) var(--sp-4)" }}>
          <div style={{ color: "var(--text-muted)", marginBottom: "var(--sp-3)" }}>
            <Icon name="alert-triangle" size={32} />
          </div>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-sec)" }}>
            No harassment reports yet. Use the Alert tab to file one.
          </p>
        </div>
      )}

      {/* Sighting list */}
      {tab === "sightings" && sightings.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
          {sightings.map((s) => (
            <div key={s.id} class="card" style={{ padding: "var(--sp-3) var(--sp-4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Plate or description */}
                  {s.plate ? (
                    <div style={{
                      fontFamily: "var(--font-mono)", fontWeight: 700,
                      letterSpacing: "2px", fontSize: "var(--text-base)",
                    }}>
                      {s.plate}
                    </div>
                  ) : s.vehicleDescription ? (
                    <div style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>
                      {s.vehicleDescription.length > 60 ? s.vehicleDescription.slice(0, 60) + "..." : s.vehicleDescription}
                    </div>
                  ) : (
                    <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>No plate recorded</div>
                  )}

                  {/* Activity */}
                  {s.activityDescription && (
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--text-sec)", marginTop: 2 }}>
                      {s.activityDescription.length > 80 ? s.activityDescription.slice(0, 80) + "..." : s.activityDescription}
                    </div>
                  )}

                  {/* Meta row */}
                  <div style={{ display: "flex", gap: "var(--sp-3)", marginTop: "var(--sp-2)", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                    <span>{formatDate(s.observedAt)}</span>
                    <span>{formatTime(s.observedAt)}</span>
                    {s.direction && <span>{s.direction}</span>}
                  </div>
                </div>

                {/* Tag badge */}
                {s.operatorTag && (
                  <span style={{
                    flexShrink: 0, marginLeft: "var(--sp-3)",
                    fontSize: "var(--text-xs)", fontWeight: 500,
                    padding: "2px 8px", borderRadius: "var(--radius-sm)",
                    background: "var(--accent-soft)", color: "var(--accent)",
                  }}>{s.operatorTag}</span>
                )}
              </div>
              {/* Operator response */}
              {s.operatorResponse && (
                <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: "var(--sp-2)", fontStyle: "italic", lineHeight: 1.5 }}>
                  {s.operatorResponse}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Alerts list */}
      {tab === "alerts" && alerts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
          {alerts.map((a) => (
            <div key={a.id} class="card" style={{ padding: "var(--sp-3) var(--sp-4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontWeight: 600, letterSpacing: "0.05em", fontSize: "var(--text-sm)" }}>
                    ***-***-{a.phoneNumber.slice(-4)}
                  </div>
                  <div style={{ display: "flex", gap: "var(--sp-2)", marginTop: "var(--sp-1)", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                    <span style={{ textTransform: "capitalize" }}>{a.incidentType.replace("_", " ")}</span>
                    <span>{formatDate(a.occurredAt)}</span>
                  </div>
                  {a.description && (
                    <p style={{ fontSize: "var(--text-xs)", color: "var(--text-sec)", marginTop: "var(--sp-1)" }}>
                      {a.description.length > 80 ? a.description.slice(0, 80) + "..." : a.description}
                    </p>
                  )}
                </div>
                {a.operatorTag && (
                  <span style={{
                    flexShrink: 0, marginLeft: "var(--sp-3)",
                    fontSize: "var(--text-xs)", fontWeight: 500,
                    padding: "2px 8px", borderRadius: "var(--radius-sm)",
                    background: "var(--accent-soft)", color: "var(--accent)",
                  }}>{a.operatorTag}</span>
                )}
              </div>
              {a.operatorResponse && (
                <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: "var(--sp-2)", fontStyle: "italic", lineHeight: 1.5 }}>
                  {a.operatorResponse}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Burst review */}
      {tab === "burst" && (() => {
        const burstItems = sightings.filter((s: any) => s.activityDescription?.includes("[Burst capture"));
        const tagged = burstItems.filter((s: any) => s.plate || (s.activityDescription && !s.activityDescription.includes("[Burst capture - no description]")));
        const untagged = burstItems.filter((s: any) => !s.plate && s.activityDescription?.includes("[Burst capture - no description]"));

        if (burstItems.length === 0) return (
          <div style={{ textAlign: "center", padding: "var(--sp-8) 0", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 28, marginBottom: "var(--sp-2)" }}>📷</div>
            <p style={{ fontSize: "var(--text-sm)" }}>No burst captures yet</p>
            <p style={{ fontSize: "var(--text-xs)", marginTop: "var(--sp-1)" }}>Use the red burst button to rapid-fire photos in the field</p>
          </div>
        );

        return (
          <div>
            <div style={{ display: "flex", gap: "var(--sp-2)", marginBottom: "var(--sp-3)", fontSize: "var(--text-xs)" }}>
              <span style={{ padding: "2px 8px", borderRadius: 6, background: untagged.length > 0 ? "rgba(231,76,60,0.15)" : "rgba(39,174,96,0.15)", color: untagged.length > 0 ? "#e74c3c" : "#27ae60", fontWeight: 600 }}>
                {untagged.length} untagged
              </span>
              <span style={{ padding: "2px 8px", borderRadius: 6, background: "var(--accent-soft)", color: "var(--accent)", fontWeight: 600 }}>
                {tagged.length} tagged
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
              {burstItems.map((s: any) => (
                <BurstReviewCard key={s.id} sighting={s} onUpdated={loadHistory} />
              ))}
            </div>
          </div>
        );
      })()}

      {/* Refresh */}
      {((tab === "sightings" && sightings.length > 0) || (tab === "alerts" && alerts.length > 0) || (tab === "burst" && sightings.some((s: any) => s.activityDescription?.includes("[Burst capture")))) && (
        <div style={{ textAlign: "center", marginTop: "var(--sp-4)" }}>
          <button class="btn btn-ghost" onClick={loadHistory} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      )}
    </div>
  );
}


/* ── Burst Review Card ── */
function BurstReviewCard({ sighting, onUpdated }: { sighting: any; onUpdated: () => void }) {
  const [editing, setEditing] = useState(false);
  const [plate, setPlate] = useState(sighting.plate || "");
  const [desc, setDesc] = useState(
    sighting.activityDescription?.includes("[Burst capture") ? "" : (sighting.activityDescription || "")
  );
  const [saving, setSaving] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const isTagged = sighting.plate || (sighting.activityDescription && !sighting.activityDescription.includes("[Burst capture - no description]"));

  // Load first photo
  useEffect(() => {
    const token = getToken();
    fetch(`${API_BASE}/sightings/${sighting.id}/photos`, {
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    }).then(r => r.ok ? r.json() : []).then((photos: any[]) => {
      if (photos.length > 0 && photos[0].photoData) {
        setPhotoUrl(`data:${photos[0].mimeType || "image/jpeg"};base64,${photos[0].photoData}`);
      }
    }).catch(() => {});
  }, [sighting.id]);
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const save = async () => {
    setSaving(true);
    try {
      const token = getToken();
      await fetch(`${API_BASE}/sightings/${sighting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          plate: plate.toUpperCase() || undefined,
          activityDescription: desc || undefined,
        }),
      });
      setEditing(false);
      onUpdated();
    } catch {}
    setSaving(false);
  };

  return (
    <div class="card" style={{ padding: "var(--sp-3) var(--sp-4)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--sp-3)" }}>
        {/* Photo thumbnail */}
        {photoUrl && (
          <div style={{ width: 56, height: 56, borderRadius: 6, overflow: "hidden", flexShrink: 0, border: "1px solid var(--border)" }}>
            <img src={photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", marginBottom: "var(--sp-1)" }}>
            <span style={{
              fontSize: "var(--text-xs)", fontWeight: 600, padding: "1px 6px", borderRadius: 4,
              background: isTagged ? "rgba(39,174,96,0.15)" : "rgba(231,76,60,0.15)",
              color: isTagged ? "#27ae60" : "#e74c3c",
            }}>{isTagged ? "Tagged" : "Untagged"}</span>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{formatDate(sighting.observedAt)}</span>
          </div>
          {sighting.plate && (
            <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: "0.08em", fontSize: "var(--text-sm)" }}>{sighting.plate}</div>
          )}
          {sighting.activityDescription && !sighting.activityDescription.includes("[Burst capture - no description]") && (
            <p style={{ fontSize: "var(--text-xs)", color: "var(--text-sec)", marginTop: "var(--sp-1)" }}>
              {sighting.activityDescription.length > 80 ? sighting.activityDescription.slice(0, 80) + "..." : sighting.activityDescription}
            </p>
          )}
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} style={{
            flexShrink: 0, marginLeft: "var(--sp-2)",
            padding: "4px 10px", borderRadius: 6, fontSize: "var(--text-xs)",
            background: "var(--accent-soft)", color: "var(--accent)", border: "none", fontWeight: 600,
          }}>{isTagged ? "Edit" : "Tag"}</button>
        )}
      </div>

      {editing && (
        <div style={{ marginTop: "var(--sp-3)", paddingTop: "var(--sp-3)", borderTop: "1px solid var(--border)" }}>
          <div style={{ marginBottom: "var(--sp-2)" }}>
            <label style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", display: "block", marginBottom: 2 }}>Plate number</label>
            <input value={plate} onInput={(e: any) => setPlate(e.target.value.toUpperCase())}
              placeholder="ABC-1234"
              style={{
                width: "100%", padding: "8px 12px", borderRadius: 6, fontSize: "var(--text-sm)",
                background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)",
                fontFamily: "var(--font-mono)",
              }} />
          </div>
          <div style={{ marginBottom: "var(--sp-3)" }}>
            <label style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", display: "block", marginBottom: 2 }}>Description</label>
            <input value={desc} onInput={(e: any) => setDesc(e.target.value)}
              placeholder="What was happening?"
              style={{
                width: "100%", padding: "8px 12px", borderRadius: 6, fontSize: "var(--text-sm)",
                background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)",
              }} />
          </div>
          <div style={{ display: "flex", gap: "var(--sp-2)" }}>
            <button onClick={save} disabled={saving} style={{
              flex: 1, padding: "8px", borderRadius: 6, fontSize: "var(--text-sm)", fontWeight: 600,
              background: "var(--accent)", color: "var(--accent-text)", border: "none",
              opacity: saving ? 0.6 : 1,
            }}>{saving ? "Saving..." : "Save"}</button>
            <button onClick={() => setEditing(false)} style={{
              padding: "8px 12px", borderRadius: 6, fontSize: "var(--text-sm)",
              background: "var(--surface)", color: "var(--text-sec)", border: "1px solid var(--border)",
            }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
