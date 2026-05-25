/**
 * TRACE PWA — Vehicle Search
 *
 * Reporter-side lightweight lookup: "has this been seen before?"
 * Read-only search by plate or description.
 */
import { useState } from "preact/hooks";
import { api } from "../lib/api.js";

export function Search() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<Record<string, unknown>>>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (query.length < 2) return;
    setSearching(true);
    try {
      const data = await api.searchVehicles(query);
      setResults(data);
    } catch {
      setResults([]);
    }
    setSearching(false);
  };

  return (
    <div>
      <h2 style={{ fontSize: 20, marginBottom: 16 }}>Vehicle Search</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          placeholder="Plate or description..."
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          style={{
            flex: 1, padding: "12px 16px",
            background: "#1a1a2e", border: "1px solid #2a2a3e",
            borderRadius: 8, color: "#e0e0e0", fontSize: 16,
            letterSpacing: 1,
          }}
        />
        <button onClick={handleSearch} disabled={searching}
          style={{
            padding: "12px 20px", background: "#4fc3f7", color: "#0f0f1a",
            border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer",
          }}
        >
          {searching ? "..." : "Go"}
        </button>
      </div>

      {results.length === 0 && query.length >= 2 && !searching && (
        <p style={{ color: "#666", textAlign: "center", marginTop: 32 }}>No vehicles found</p>
      )}

      {results.map((v: any) => (
        <div key={v.id} style={{
          padding: 16, marginBottom: 8, background: "#1a1a2e",
          borderRadius: 8, borderLeft: `4px solid ${v.status === "active" ? "#4fc3f7" : "#666"}`,
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 2 }}>
            {v.plate || "No plate"}
          </div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
            {[v.color, v.year, v.make, v.model].filter(Boolean).join(" ")}
          </div>
          {v.description && (
            <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>{v.description}</div>
          )}
          <div style={{ fontSize: 11, color: "#555", marginTop: 8 }}>
            Last seen: {v.lastSeenAt ? new Date(v.lastSeenAt).toLocaleDateString() : "unknown"}
          </div>
        </div>
      ))}
    </div>
  );
}
