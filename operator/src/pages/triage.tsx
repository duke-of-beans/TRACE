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

  const approve = useCallback(() => {
    if (!current) return;
    setSightings((s) => s.filter((_, i) => i !== selected));
    if (selected >= sightings.length - 1) setSelected(Math.max(0, selected - 1));
    toast(`Sighting ${current.plate || current.id?.slice(0, 8)} approved`, "success");
  }, [current, selected, sightings.length, toast]);

  const flag = useCallback(() => {
    if (!current) return;
    toast(`Sighting ${current.plate || current.id?.slice(0, 8)} flagged for follow-up`, "warning");
  }, [current, toast]);

  const dismiss = useCallback(async () => {
    if (!current) return;
    const ok = await confirm({
      title: "Dismiss sighting?",
      message: "This sighting will be removed from the triage queue. It won't be deleted from the database.",
      confirmLabel: "Dismiss",
    });
    if (!ok) return;
    setSightings((s) => s.filter((_, i) => i !== selected));
    if (selected >= sightings.length - 1) setSelected(Math.max(0, selected - 1));
    toast("Sighting dismissed", "info");
  }, [current, selected, sightings.length, confirm, toast]);

  const escalate = useCallback(() => {
    if (!current) return;
    toast(`Sighting ${current.plate || current.id?.slice(0, 8)} escalated`, "error");
  }, [current, toast]);

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
          <h2 className="text-lg font-semibold">
            {sightings.length} pending
            {liveCount > 0 && (
              <span className="ml-2 inline-block w-2 h-2 rounded-full bg-trace-confirm animate-pulse" />
            )}
          </h2>
          <button onClick={load} className="text-xs text-trace-accent">↻</button>
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
            <div className="font-mono text-sm font-bold tracking-wider">
              {s.plate || "No plate"}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {new Date(s.submittedAt).toLocaleString()}
            </div>
            {s.activityDescription && (
              <div className="text-xs text-gray-400 mt-1 truncate">{s.activityDescription}</div>
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
                <p className="text-sm text-gray-500 mt-1">
                  Observed {new Date(current.observedAt).toLocaleString()}
                </p>
              </div>
              <span className="text-xs text-gray-600 bg-trace-bg px-3 py-1 rounded">
                {current.id?.slice(0, 8)}
              </span>
            </div>

            {current.vehicleDescription && (
              <div className="mb-4">
                <label className="text-xs text-gray-500 uppercase tracking-wider">Vehicle</label>
                <p className="mt-1">{current.vehicleDescription}</p>
              </div>
            )}

            {current.activityDescription && (
              <div className="mb-4">
                <label className="text-xs text-gray-500 uppercase tracking-wider">Activity</label>
                <p className="mt-1">{current.activityDescription}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-4">
              {current.direction && (
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider">Direction</label>
                  <p className="mt-1 text-lg font-semibold">{current.direction}</p>
                </div>
              )}
              {current.lat && (
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider">Location</label>
                  <p className="mt-1 font-mono text-sm">
                    {current.lat.toFixed(4)}, {current.lng?.toFixed(4)}
                  </p>
                </div>
              )}
            </div>

            {current.notes && (
              <div className="mb-6">
                <label className="text-xs text-gray-500 uppercase tracking-wider">Notes</label>
                <p className="mt-1 text-gray-300">{current.notes}</p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 pt-4 border-t border-trace-border">
              <ActionBtn label="Approve" shortcut="A" color="bg-trace-confirm" onClick={approve} />
              <ActionBtn label="Flag" shortcut="F" color="bg-trace-warning" onClick={flag} />
              <ActionBtn label="Dismiss" shortcut="D" color="bg-gray-600" onClick={dismiss} />
              <ActionBtn label="Escalate" shortcut="E" color="bg-trace-danger" onClick={escalate} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBtn(props: { label: string; shortcut: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={props.onClick}
      className={`${props.color} text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition`}
    >
      {props.label} <span className="text-xs opacity-60 ml-1">[{props.shortcut}]</span>
    </button>
  );
}
