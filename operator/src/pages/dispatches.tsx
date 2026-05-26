/**
 * TRACE Operator — Dispatch Management
 *
 * All dispatches: active, closed, expired.
 * Response times, outcomes, filters.
 */
import { useState, useEffect } from "react";
import { api } from "../lib/api.js";
import { useToast, EmptyState, SkeletonList } from "../components/ux/index.js";
import { Icon } from "../components/icon.js";

type StatusFilter = "all" | "open" | "responding" | "on_scene" | "closed" | "expired";

const STATUS_COLORS: Record<string, string> = {
  open: "#D97706",
  responding: "#4F8EF7",
  on_scene: "#22C55E",
  closed: "#64748B",
  expired: "#94A3B8",
};

export function Dispatches() {
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [eventTypes, setEventTypes] = useState<any[]>([]);
  const toast = useToast();

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [d, t] = await Promise.all([
        api.getDispatches(),
        api.getDispatchEventTypes().catch(() => []),
      ]);
      setDispatches(Array.isArray(d) ? d : []);
      setEventTypes(Array.isArray(t) ? t : []);
    } catch { toast("Failed to load dispatches", "error"); }
    setLoading(false);
  };

  const handleClose = async (id: string) => {
    try {
      await api.closeDispatch(id, "Manually closed by operator");
      toast("Dispatch closed", "info");
      load();
    } catch { toast("Failed to close", "error"); }
  };

  const filtered = filter === "all" ? dispatches : dispatches.filter((d) => d.status === filter);
  const etMap = new Map(eventTypes.map((t: any) => [t.id, t]));

  const timeAgo = (iso: string) => {
    if (!iso) return "";
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
    return `${Math.round(mins / 1440)}d ago`;
  };

  // Stats
  const stats = {
    total: dispatches.length,
    active: dispatches.filter((d) => ["open", "responding", "on_scene"].includes(d.status)).length,
    closed: dispatches.filter((d) => d.status === "closed").length,
    expired: dispatches.filter((d) => d.status === "expired").length,
  };

  if (loading) return <SkeletonList count={6} />;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Dispatches</h1>
        <button onClick={load} className="text-xs" style={{ color: "var(--accent)" }}>
          <Icon name="clock" size={14} /> Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total", value: stats.total, color: "var(--text)" },
          { label: "Active", value: stats.active, color: "#22C55E" },
          { label: "Closed", value: stats.closed, color: "#64748B" },
          { label: "Expired", value: stats.expired, color: "#94A3B8" },
        ].map((s) => (
          <div key={s.label} className="bg-trace-surface rounded-lg p-3 border border-trace-border text-center">
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {(["all", "open", "responding", "on_scene", "closed", "expired"] as StatusFilter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-xs transition whitespace-nowrap ${
              filter === f ? "bg-trace-surface text-trace-accent font-medium" : "text-gray-500 hover:text-gray-300"
            }`}>
            {f === "all" ? "All" : f === "on_scene" ? "On Scene" : f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== "all" && ` (${dispatches.filter((d) => d.status === f).length})`}
          </button>
        ))}
      </div>

      {/* Dispatch list */}
      {filtered.length === 0 ? (
        <EmptyState icon="📋" title="No dispatches" description={filter === "all" ? "No dispatches created yet." : `No ${filter} dispatches.`} />
      ) : (
        <div className="space-y-2">
          {filtered.map((d: any) => {
            const et = d.eventTypeId ? etMap.get(d.eventTypeId) : null;
            return (
              <div key={d.id} className="bg-trace-surface rounded-lg p-4 border border-trace-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {/* Status badge */}
                    <span className="text-[10px] px-2 py-0.5 rounded font-semibold uppercase"
                      style={{ background: `${STATUS_COLORS[d.status] || "#64748B"}20`, color: STATUS_COLORS[d.status] || "#64748B" }}>
                      {d.status === "on_scene" ? "On Scene" : d.status}
                    </span>
                    {/* Priority */}
                    {d.priority === "urgent" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: "rgba(220,38,38,0.15)", color: "#DC2626" }}>!</span>
                    )}
                    {/* Event type */}
                    {et && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${et.color}20`, color: et.color }}>
                        {et.label}
                      </span>
                    )}
                  </div>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{timeAgo(d.createdAt)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    {d.plate && (
                      <span className="font-mono font-bold tracking-wider text-sm">{d.plate}</span>
                    )}
                    {d.notes && (
                      <p className="text-xs mt-1 truncate" style={{ color: "var(--text-sec)", maxWidth: 400 }}>{d.notes}</p>
                    )}
                    <div className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                      {d.lat?.toFixed(4)}, {d.lng?.toFixed(4)}
                      {d.closeReason && ` · ${d.closeReason}`}
                    </div>
                  </div>

                  {/* Close button for active dispatches */}
                  {["open", "responding", "on_scene"].includes(d.status) && (
                    <button onClick={() => handleClose(d.id)}
                      className="text-xs px-3 py-1.5 rounded-lg"
                      style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-sec)" }}>
                      Close
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
