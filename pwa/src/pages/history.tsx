/**
 * TRACE PWA — Submission History
 *
 * Shows the reporter's own submissions only.
 * No other reporter data visible (reporter-to-reporter invisibility).
 * Queued (offline) items shown separately from synced items.
 */
import { useState, useEffect } from "preact/hooks";
import { api, getToken } from "../lib/api.js";
import { getQueueCount, drainQueue } from "../lib/queue.js";
import { Icon } from "../components/icon.js";

type Sighting = {
  id: string;
  plate?: string;
  vehicleDescription?: string;
  activityDescription?: string;
  direction?: string;
  observedAt: string;
  submittedAt: string;
  triaged: boolean;
  lat: number;
  lng: number;
};

export function History() {
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const loadHistory = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.getMySightings();
      setSightings(Array.isArray(data) ? (data as Sighting[]) : []);
    } catch (err) {
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
      <h1 class="page-title">My Submissions</h1>

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
      {!loading && !error && getToken() && sightings.length === 0 && (
        <div class="card" style={{ textAlign: "center", padding: "var(--sp-8) var(--sp-4)" }}>
          <div style={{ color: "var(--text-muted)", marginBottom: "var(--sp-3)" }}>
            <Icon name="send" size={32} />
          </div>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-sec)" }}>
            No submissions yet. Reports will appear here after you submit them.
          </p>
        </div>
      )}

      {/* Sighting list */}
      {sightings.length > 0 && (
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

                {/* Triage status */}
                <div style={{
                  flexShrink: 0, marginLeft: "var(--sp-3)",
                  fontSize: "var(--text-xs)", fontWeight: 500,
                  padding: "2px 8px", borderRadius: "var(--radius-sm)",
                  background: s.triaged ? "rgba(34,197,94,0.12)" : "rgba(148,163,184,0.12)",
                  color: s.triaged ? "var(--success)" : "var(--text-muted)",
                }}>
                  {s.triaged ? "Reviewed" : "Pending"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Refresh */}
      {sightings.length > 0 && (
        <div style={{ textAlign: "center", marginTop: "var(--sp-4)" }}>
          <button class="btn btn-ghost" onClick={loadHistory} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      )}
    </div>
  );
}
