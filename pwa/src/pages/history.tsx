/**
 * TRACE PWA — Submission History
 *
 * Shows the reporter's own submissions only.
 * No other reporter data visible (reporter-to-reporter invisibility).
 */
import { useState, useEffect } from "preact/hooks";
import { getQueuedCount, drainQueue } from "../lib/api.js";

export function History() {
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    getQueuedCount().then(setQueueCount);
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    const result = await drainQueue();
    setQueueCount(await getQueuedCount());
    setSyncing(false);
    alert(`Synced: ${result.sent} sent, ${result.failed} failed`);
  };

  return (
    <div>
      <h2 style={{ fontSize: 20, marginBottom: 16 }}>My Submissions</h2>

      {queueCount > 0 && (
        <div style={{
          padding: 16, marginBottom: 16, background: "#2a1a1a",
          borderRadius: 8, border: "1px solid #e74c3c",
        }}>
          <p style={{ color: "#e74c3c", fontWeight: 600 }}>
            {queueCount} sighting{queueCount > 1 ? "s" : ""} queued offline
          </p>
          <button onClick={handleSync} disabled={syncing}
            style={{
              marginTop: 8, padding: "8px 20px",
              background: "#e74c3c", color: "#fff", border: "none",
              borderRadius: 6, cursor: "pointer",
            }}
          >
            {syncing ? "Syncing..." : "Sync Now"}
          </button>
        </div>
      )}

      <p style={{ color: "#666", textAlign: "center", marginTop: 32 }}>
        Submission history loads from server.
        {/* TODO: fetch /api/v1/sightings?reporter=me */}
      </p>
    </div>
  );
}
