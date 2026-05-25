/**
 * TRACE Operator — Triage Queue
 *
 * New sightings arrive here for operator review.
 * Keyboard-driven: A=approve, F=flag, D=dismiss, E=escalate, N=next
 */
import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api.js";
import { useHotkeys } from "../lib/hotkeys.js";

export function Triage() {
  const [sightings, setSightings] = useState<any[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => { load(); }, []);

  const current = sightings[selected];

  const approve = useCallback(() => {
    if (!current) return;
    // TODO: PATCH sighting as triaged
    setSightings((s) => s.filter((_, i) => i !== selected));
    if (selected >= sightings.length - 1) setSelected(Math.max(0, selected - 1));
  }, [current, selected, sightings.length]);

  const flag = useCallback(() => {
    if (!current) return;
    // TODO: flag sighting for follow-up
    console.log("Flagged:", current.id);
  }, [current]);

  const dismiss = useCallback(() => {
    if (!current) return;
    setSightings((s) => s.filter((_, i) => i !== selected));
    if (selected >= sightings.length - 1) setSelected(Math.max(0, selected - 1));
  }, [current, selected, sightings.length]);

  const escalate = useCallback(() => {
    if (!current) return;
    // TODO: escalate - promote vehicle suspicion level
    console.log("Escalated:", current.id);
  }, [current]);

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

  if (loading) return <div className="text-gray-500">Loading triage queue...</div>;

  if (sightings.length === 0) {
    return (
      <div className="text-center mt-32">
        <div className="text-4xl mb-4">✓</div>
        <p className="text-gray-500">Triage queue is empty</p>
        <button onClick={load} className="mt-4 text-trace-accent text-sm">Refresh</button>
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      {/* Queue list */}
      <div className="w-80 space-y-2 max-h-[calc(100vh-3rem)] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">{sightings.length} pending</h2>
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
