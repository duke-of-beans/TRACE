/**
 * TRACE Operator — Reports Page
 *
 * Vehicle behavior patterns and co-occurrence analysis.
 * Client format: "Vehicle ABC seen on Wilbur Rd 4 times in 2 weeks, 3 times 7-8am"
 */
import { useState, useEffect } from "react";
import { api } from "../lib/api.js";
import { Icon } from "../components/icon.js";
import { useToast, HelpTip, ErrorBoundary } from "../components/ux/index.js";

type Tab = "behavior" | "cooccurrence";

export function Reports() {
  const [tab, setTab] = useState<Tab>("behavior");
  const toast = useToast();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text)" }}>Reports</h1>
      <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
        Pattern analysis across sighting data. Select a date range and generate.
      </p>

      <div className="flex gap-2 mb-6">
        {([
          { key: "behavior" as Tab, label: "Vehicle Behavior", icon: "zap" },
          { key: "cooccurrence" as Tab, label: "Co-occurrence", icon: "users" },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition"
            style={{
              background: tab === t.key ? "var(--accent-soft)" : "transparent",
              color: tab === t.key ? "var(--accent)" : "var(--text-sec)",
              border: `1px solid ${tab === t.key ? "var(--accent)" : "var(--border)"}`,
            }}>
            <Icon name={t.icon} size={14} />
            {t.label}
          </button>
        ))}
      </div>

      <ErrorBoundary>
        {tab === "behavior" && <BehaviorReport />}
        {tab === "cooccurrence" && <CoOccurrenceReport />}
      </ErrorBoundary>
    </div>
  );
}

function BehaviorReport() {
  const [range, setRange] = useState("14d");
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useEffect(() => { api.getVehicles().then(v => setVehicles(Array.isArray(v) ? v : [])).catch(() => {}); }, []);

  const load = async () => {
    setLoading(true);
    const now = new Date();
    const days = range === "7d" ? 7 : range === "14d" ? 14 : range === "30d" ? 30 : 90;
    const start = new Date(now.getTime() - days * 86400000).toISOString();
    try {
      const r = await api.getBehaviorReport({ start, end: now.toISOString(), vehicleId: vehicleFilter || undefined });
      setData(Array.isArray(r) ? r : []);
      if (Array.isArray(r) && r.length === 0) toast("No patterns found in this range", "info");
    } catch { toast("Failed to load report", "error"); }
    setLoading(false);
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-1">
          {["7d", "14d", "30d", "90d"].map(r => (
            <button key={r} onClick={() => setRange(r)}
              className="px-3 py-1.5 rounded text-xs font-medium"
              style={{
                background: range === r ? "var(--accent)" : "var(--surface)",
                color: range === r ? "var(--accent-text)" : "var(--text-sec)",
                border: `1px solid ${range === r ? "var(--accent)" : "var(--border)"}`,
              }}>{r}</button>
          ))}
        </div>
        <select value={vehicleFilter} onChange={e => setVehicleFilter(e.target.value)}
          className="bg-trace-bg border border-trace-border rounded-lg px-3 py-1.5 text-xs" style={{ colorScheme: "dark", minWidth: 120 }}>
          <option value="">All vehicles</option>
          {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate || v.id.slice(0, 8)}</option>)}
        </select>
        <button onClick={load} disabled={loading}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: "var(--accent)", color: "var(--accent-text)", border: "none", opacity: loading ? 0.6 : 1 }}>
          {loading ? "Loading..." : "Generate"}
        </button>
        <HelpTip text="Groups sightings by vehicle and location. Shows repeat visits and time-of-day patterns." />
      </div>

      {data.length === 0 && !loading && (
        <div className="text-center py-12" style={{ color: "var(--text-muted)" }}>
          <Icon name="zap" size={32} />
          <p className="mt-2 text-sm">Select a range and click Generate</p>
        </div>
      )}

      <div className="space-y-4">
        {data.map((v: any) => (
          <div key={v.vehicleId} className="rounded-lg p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold tracking-wider text-lg">{v.plate || "No plate"}</span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{[v.color, v.make, v.model].filter(Boolean).join(" ")}</span>
              </div>
              <span className="text-xs px-2 py-1 rounded" style={{ background: "var(--accent-soft)", color: "var(--accent)", fontWeight: 600 }}>
                {v.totalSightings} sightings
              </span>
            </div>

            {v.clusters.map((c: any, i: number) => (
              <div key={i} className="ml-4 py-2" style={{ borderLeft: "2px solid var(--border)", paddingLeft: 16, marginBottom: 8 }}>
                <div className="text-sm font-medium" style={{ color: "var(--text-sec)" }}>
                  {c.locationDescription || `${c.centerLat.toFixed(4)}, ${c.centerLng.toFixed(4)}`}
                  <span className="ml-2 font-bold" style={{ color: "var(--accent)" }}>{c.sightingCount}×</span>
                </div>
                <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  Dates: {c.dates.join(", ")}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {Object.entries(c.timeOfDay).sort(([, a]: any, [, b]: any) => b - a).map(([time, count]: any) => (
                    <span key={time} className="text-xs px-2 py-0.5 rounded"
                      style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-sec)" }}>
                      {time}: {count}×
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {data.length > 0 && (
        <div className="mt-4 flex justify-end">
          <button onClick={() => {
            const lines = data.map((v: any) => {
              const vLabel = `${v.plate || "Unknown"} (${[v.color, v.make, v.model].filter(Boolean).join(" ")})`;
              const clusterLines = v.clusters.map((c: any) => {
                const loc = c.locationDescription || `${c.centerLat.toFixed(4)}, ${c.centerLng.toFixed(4)}`;
                const topTimes = Object.entries(c.timeOfDay).sort(([, a]: any, [, b]: any) => b - a).slice(0, 3).map(([t, n]: any) => `${n}× ${t}`).join(", ");
                return `  ${loc}: ${c.sightingCount} times on ${c.dates.join(", ")}${topTimes ? ` - ${topTimes}` : ""}`;
              });
              return `${vLabel} - ${v.totalSightings} sightings\n${clusterLines.join("\n")}`;
            });
            navigator.clipboard.writeText(lines.join("\n\n"));
            toast("Report copied to clipboard", "success");
          }}
            className="px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-sec)" }}>
            <Icon name="file-text" size={14} />
            Copy as text
          </button>
        </div>
      )}
    </div>
  );
}

function CoOccurrenceReport() {
  const [range, setRange] = useState("14d");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    const now = new Date();
    const days = range === "7d" ? 7 : range === "14d" ? 14 : range === "30d" ? 30 : 90;
    const start = new Date(now.getTime() - days * 86400000).toISOString();
    try {
      const r = await api.getCoOccurrenceReport({ start, end: now.toISOString() });
      setData(Array.isArray(r) ? r : []);
      if (Array.isArray(r) && r.length === 0) toast("No co-occurrences found in this range", "info");
    } catch { toast("Failed to load report", "error"); }
    setLoading(false);
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-1">
          {["7d", "14d", "30d", "90d"].map(r => (
            <button key={r} onClick={() => setRange(r)}
              className="px-3 py-1.5 rounded text-xs font-medium"
              style={{
                background: range === r ? "var(--accent)" : "var(--surface)",
                color: range === r ? "var(--accent-text)" : "var(--text-sec)",
                border: `1px solid ${range === r ? "var(--accent)" : "var(--border)"}`,
              }}>{r}</button>
          ))}
        </div>
        <button onClick={load} disabled={loading}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: "var(--accent)", color: "var(--accent-text)", border: "none", opacity: loading ? 0.6 : 1 }}>
          {loading ? "Loading..." : "Generate"}
        </button>
        <HelpTip text="Finds vehicle pairs that appear near each other within a short time window. Indicates vehicles that may be operating together." />
      </div>

      {data.length === 0 && !loading && (
        <div className="text-center py-12" style={{ color: "var(--text-muted)" }}>
          <Icon name="users" size={32} />
          <p className="mt-2 text-sm">Select a range and click Generate</p>
        </div>
      )}

      <div className="space-y-3">
        {data.map((pair: any, i: number) => (
          <div key={i} className="rounded-lg p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold tracking-wider">{pair.vehicleA.plate || "?"}</span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{[pair.vehicleA.color, pair.vehicleA.make].filter(Boolean).join(" ")}</span>
              </div>
              <span style={{ color: "var(--text-muted)", fontSize: 10 }}>+</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold tracking-wider">{pair.vehicleB.plate || "?"}</span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{[pair.vehicleB.color, pair.vehicleB.make].filter(Boolean).join(" ")}</span>
              </div>
              <span className="ml-auto text-xs px-2 py-1 rounded font-bold"
                style={{ background: pair.encounters >= 4 ? "rgba(239,68,68,0.15)" : "var(--accent-soft)", color: pair.encounters >= 4 ? "#ef4444" : "var(--accent)" }}>
                {pair.encounters} encounters
              </span>
            </div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              {new Date(pair.firstSeen).toLocaleDateString()} — {new Date(pair.lastSeen).toLocaleDateString()}
              <span className="ml-2">·</span>
              <span className="ml-2">{pair.locations.length} location{pair.locations.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
        ))}
      </div>

      {data.length > 0 && (
        <div className="mt-4 flex justify-end">
          <button onClick={() => {
            const lines = data.map((p: any) => {
              const a = `${p.vehicleA.plate || "?"} (${[p.vehicleA.color, p.vehicleA.make].filter(Boolean).join(" ")})`;
              const b = `${p.vehicleB.plate || "?"} (${[p.vehicleB.color, p.vehicleB.make].filter(Boolean).join(" ")})`;
              return `${a} + ${b}: ${p.encounters} encounters (${new Date(p.firstSeen).toLocaleDateString()} - ${new Date(p.lastSeen).toLocaleDateString()})`;
            });
            navigator.clipboard.writeText(lines.join("\n"));
            toast("Report copied to clipboard", "success");
          }}
            className="px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-sec)" }}>
            <Icon name="file-text" size={14} />
            Copy as text
          </button>
        </div>
      )}
    </div>
  );
}
