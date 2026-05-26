/**
 * TRACE Operator — Triage Queue
 *
 * New sightings arrive here for operator review.
 * Keyboard-driven: A=approve, F=flag, D=dismiss, E=escalate, N=next
 */
import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api.js";
import { useHotkeys } from "../lib/hotkeys.js";
import { connect, onEvent } from "../lib/ws.js";
import { useToast, useConfirm, EmptyState, EMPTY_STATES, SkeletonList, HelpTip } from "../components/ux/index.js";
import { Icon } from "../components/icon.js";

export function Triage() {
  const [sightings, setSightings] = useState<any[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(true);
  const [liveCount, setLiveCount] = useState(0);
  const toast = useToast();
  const confirm = useConfirm();

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getSightings(true);
      setSightings(data);
    } catch (err) {
      console.error("Failed to load sightings:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();

    // connect WebSocket for live updates
    connect("", "operator"); // chapterId filled from auth context
    const unsub = onEvent((event) => {
      if (event.type === "sighting.new") {
        setSightings((prev) => [event.data.sighting, ...prev]);
        setLiveCount((c) => c + 1);
        // clear live indicator after 3s
        setTimeout(() => setLiveCount((c) => Math.max(0, c - 1)), 3000);
      }
    });

    return unsub;
  }, []);

  const current = sightings[selected];

  const approve = useCallback(async () => {
    if (!current) return;
    try {
      await api.triageSighting(current.id, "approve");
      setSightings((s) => s.filter((_, i) => i !== selected));
      if (selected >= sightings.length - 1) setSelected(Math.max(0, selected - 1));
      toast(`Sighting ${current.plate || current.id?.slice(0, 8)} approved`, "success");
    } catch { toast("Failed to approve", "error"); }
  }, [current, selected, sightings.length, toast]);

  const flag = useCallback(async () => {
    if (!current) return;
    try {
      await api.triageSighting(current.id, "flag");
      setSightings((s) => s.filter((_, i) => i !== selected));
      if (selected >= sightings.length - 1) setSelected(Math.max(0, selected - 1));
      toast(`Sighting ${current.plate || current.id?.slice(0, 8)} flagged for follow-up`, "warning");
    } catch { toast("Failed to flag", "error"); }
  }, [current, selected, sightings.length, toast]);

  const dismiss = useCallback(async () => {
    if (!current) return;
    const ok = await confirm({
      title: "Dismiss sighting?",
      message: "This sighting will be marked as triaged and removed from the queue.",
      confirmLabel: "Dismiss",
    });
    if (!ok) return;
    try {
      await api.triageSighting(current.id, "dismiss");
      setSightings((s) => s.filter((_, i) => i !== selected));
      if (selected >= sightings.length - 1) setSelected(Math.max(0, selected - 1));
      toast("Sighting dismissed", "info");
    } catch { toast("Failed to dismiss", "error"); }
  }, [current, selected, sightings.length, confirm, toast]);

  const escalate = useCallback(async () => {
    if (!current) return;
    try {
      await api.triageSighting(current.id, "escalate");
      setSightings((s) => s.filter((_, i) => i !== selected));
      if (selected >= sightings.length - 1) setSelected(Math.max(0, selected - 1));
      toast(`Sighting ${current.plate || current.id?.slice(0, 8)} escalated`, "error");
    } catch { toast("Failed to escalate", "error"); }
  }, [current, selected, sightings.length, toast]);

  const next = useCallback(() => {
    setSelected((s) => Math.min(s + 1, sightings.length - 1));
  }, [sightings.length]);

  useHotkeys({
    a: approve,
    f: flag,
    d: dismiss,
    e: escalate,
    n: next,
    p: () => setSelected((s) => Math.max(0, s - 1)),
  });

  if (loading) {
    return (
      <div className="flex gap-6">
        <div className="w-80"><SkeletonList count={4} /></div>
        <div className="flex-1"><SkeletonList count={1} /></div>
      </div>
    );
  }

  if (sightings.length === 0) {
    return (
      <EmptyState
        {...EMPTY_STATES.triage}
        action={{ label: "Refresh", onClick: load }}
      />
    );
  }

  return (
    <div className="flex gap-6">
      {/* Queue list */}
      <div className="w-80 space-y-2 max-h-[calc(100vh-3rem)] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
            {sightings.length} pending
            {liveCount > 0 && (
              <span className="ml-2 inline-block w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--success)" }} />
            )}
          </h2>
          <button onClick={load} className="text-xs" style={{ color: "var(--accent)" }} aria-label="Refresh">
            <Icon name="clock" size={14} />
          </button>
        </div>
        {sightings.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setSelected(i)}
            className={`w-full text-left p-3 rounded-lg border transition ${
              i === selected
                ? "border-trace-accent bg-trace-surface"
                : "border-trace-border bg-trace-bg hover:bg-trace-surface"
            }`}
          >
            <div className="font-mono text-sm font-bold tracking-wider" style={{ color: "var(--text)" }}>
              {s.plate || "No plate"}
            </div>
            <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              {new Date(s.submittedAt).toLocaleString()}
            </div>
            {s.activityDescription && (
              <div className="text-xs mt-1 truncate" style={{ color: "var(--text-sec)" }}>{s.activityDescription}</div>
            )}
          </button>
        ))}
      </div>

      {/* Detail panel */}
      {current && (
        <div className="flex-1">
          <div className="bg-trace-surface rounded-lg p-6 border border-trace-border">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-2xl font-mono font-bold tracking-widest">
                  {current.plate || "No plate"}
                </h3>
                <p className="text-sm mt-1" style={{ color: "var(--text-sec)" }}>
                  Observed {new Date(current.observedAt).toLocaleString()}
                </p>
              </div>
              <span className="text-xs px-3 py-1 rounded font-mono" style={{ color: "var(--text-muted)", background: "var(--bg)" }}>
                {current.id?.slice(0, 8)}
              </span>
            </div>

            {current.vehicleDescription && (
              <div className="mb-4">
                <label className="text-xs uppercase tracking-wider" style={{ color: "var(--text-sec)" }}>Vehicle</label>
                <p className="mt-1">{current.vehicleDescription}</p>
              </div>
            )}

            {current.activityDescription && (
              <div className="mb-4">
                <label className="text-xs uppercase tracking-wider" style={{ color: "var(--text-sec)" }}>Activity</label>
                <p className="mt-1">{current.activityDescription}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-4">
              {current.direction && (
                <div>
                  <label className="text-xs uppercase tracking-wider" style={{ color: "var(--text-sec)" }}>Direction</label>
                  <p className="mt-1 text-lg font-semibold">{current.direction}</p>
                </div>
              )}
              {current.lat && (
                <div>
                  <label className="text-xs uppercase tracking-wider" style={{ color: "var(--text-sec)" }}>Location</label>
                  <p className="mt-1 font-mono text-sm">
                    <Icon name="map-pin" size={12} className="inline mr-1" />
                    {current.lat.toFixed(4)}, {current.lng?.toFixed(4)}
                  </p>
                </div>
              )}
            </div>

            {current.notes && (
              <div className="mb-6">
                <label className="text-xs uppercase tracking-wider" style={{ color: "var(--text-sec)" }}>Notes</label>
                <p className="mt-1" style={{ color: "var(--text-sec)" }}>{current.notes}</p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
              <ActionBtn label="Approve" shortcut="A" bg="var(--success)" onClick={approve} icon="check" />
              <ActionBtn label="Flag" shortcut="F" bg="var(--warning)" onClick={flag} icon="alert-triangle" />
              <ActionBtn label="Dismiss" shortcut="D" bg="var(--surface-alt)" onClick={dismiss} icon="x" textColor="var(--text-sec)" />
              <ActionBtn label="Escalate" shortcut="E" bg="var(--danger)" onClick={escalate} icon="zap" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBtn({ label, shortcut, bg, onClick, icon, textColor }: { label: string; shortcut: string; bg: string; onClick: () => void; icon: string; textColor?: string }) {
  return (
    <button onClick={onClick} className="px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition flex items-center gap-2"
      style={{ background: bg, color: textColor || "#fff", minHeight: 44 }}>
      <Icon name={icon} size={14} />
      {label} <span className="text-xs opacity-60">[{shortcut}]</span>
    </button>
  );
}
