/**
 * TRACE Operator — Triage Queue
 *
 * Core dispatch workflow:
 *   Sighting arrives → plate auto-checked → MATCH or NEW PLATE badge →
 *   Confirm & Dispatch (sends patrollers) or Dismiss & Notify (tells reporter)
 *
 * Keyboard: C=confirm+dispatch, D=dismiss+notify, F=flag, N=next, P=prev
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
  const [showDispatch, setShowDispatch] = useState(false);
  const [reporters, setReporters] = useState<any[]>([]);
  const [eventTypes, setEventTypes] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const toast = useToast();
  const confirm = useConfirm();

  const load = async () => {
    setLoading(true);
    try {
      const [data, reps, types] = await Promise.all([
        api.getSightings(true),
        api.getReporters().catch(() => []),
        api.getDispatchEventTypes().catch(() => []),
      ]);
      setSightings(data);
      setReporters(reps);
      setEventTypes(types);
    } catch (err) {
      console.error("Failed to load:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    connect("", "operator");
    const unsub = onEvent((event) => {
      if (event.type === "sighting.new") {
        setSightings((prev) => [event.data.sighting, ...prev]);
        setLiveCount((c) => c + 1);
        setTimeout(() => setLiveCount((c) => Math.max(0, c - 1)), 3000);
      }
    });
    return unsub;
  }, []);

  // Load photos for selected sighting
  useEffect(() => {
    setPhotos([]);
    const sid = sightings[selected]?.id;
    if (!sid) return;
    fetch(`${import.meta.env.VITE_API_URL || "/api/v1"}/sightings/${sid}/photos`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("trace_op_token") || ""}` },
    })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setPhotos(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [selected, sightings]);

  const current = sightings[selected];
  const isMatch = current?.plateMatched === true;
  const isNewPlate = current?.plate && current?.plateMatched === false;

  // --- Actions ---
  const removeCurrent = () => {
    setSightings((s) => s.filter((_, i) => i !== selected));
    if (selected >= sightings.length - 1) setSelected(Math.max(0, selected - 1));
  };

  const handleConfirmAndDispatch = useCallback(() => {
    if (!current) return;
    setShowDispatch(true);
  }, [current]);

  const handleDispatchSend = async (data: { reporterIds: string[]; eventTypeId?: string; priority?: string; notes?: string }) => {
    if (!current) return;
    try {
      await api.confirmAndDispatch(current.id, data);
      removeCurrent();
      setShowDispatch(false);
      toast("Confirmed. Dispatch sent.", "success");
    } catch { toast("Dispatch failed", "error"); }
  };

  const handleDismissAndNotify = useCallback(async () => {
    if (!current) return;
    try {
      await api.dismissAndNotify(current.id);
      removeCurrent();
      toast("Dismissed. Reporter notified.", "info");
    } catch { toast("Failed to dismiss", "error"); }
  }, [current, selected, sightings.length, toast]);

  const handleFlag = useCallback(async () => {
    if (!current) return;
    try {
      await api.triageSighting(current.id, "flag");
      removeCurrent();
      toast(`Flagged for follow-up`, "warning");
    } catch { toast("Failed to flag", "error"); }
  }, [current, selected, sightings.length, toast]);

  const handleAddToTracking = useCallback(async () => {
    if (!current?.plate) return;
    try {
      const vehicle = await api.createVehicle({
        plate: current.plate,
        description: current.vehicleDescription || current.activityDescription,
      });
      toast(`${current.plate} added to tracking`, "success");
      // Now offer to dispatch
      setShowDispatch(true);
    } catch { toast("Failed to add vehicle", "error"); }
  }, [current, toast]);

  const next = useCallback(() => setSelected((s) => Math.min(s + 1, sightings.length - 1)), [sightings.length]);
  const prev = useCallback(() => setSelected((s) => Math.max(0, s - 1)), []);

  useHotkeys({
    c: handleConfirmAndDispatch,
    d: handleDismissAndNotify,
    f: handleFlag,
    n: next,
    p: prev,
  });

  // --- Render ---
  if (loading) {
    return (
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        <div className="w-full lg:w-80"><SkeletonList count={4} /></div>
        <div className="flex-1"><SkeletonList count={1} /></div>
      </div>
    );
  }

  if (sightings.length === 0) {
    return <EmptyState {...EMPTY_STATES.triage} action={{ label: "Refresh", onClick: load }} />;
  }

  const timeAgo = (iso: string) => {
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
    return `${Math.round(mins / 1440)}d ago`;
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
      {/* Queue list */}
      <div className="w-full lg:w-80 space-y-2 max-h-[50vh] lg:max-h-[calc(100vh-3rem)] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">
            {sightings.length} pending
            {liveCount > 0 && (
              <span className="ml-2 inline-block w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--success)" }} />
            )}
          </h2>
          <button onClick={load} className="text-xs" style={{ color: "var(--accent)" }}><Icon name="clock" size={14} /></button>
        </div>

        {sightings.map((s, i) => (
          <button
            key={s.id}
            onClick={() => { setSelected(i); setShowDispatch(false); }}
            className={`w-full text-left p-3 rounded-lg border transition ${
              i === selected ? "border-trace-accent bg-trace-surface" : "border-trace-border bg-trace-bg hover:bg-trace-surface"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-bold tracking-wider">{s.plate || "No plate"}</span>
              {/* Plate match badge */}
              {s.plateMatched === true && (
                <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: "rgba(220,38,38,0.15)", color: "#DC2626" }}>MATCH</span>
              )}
              {s.plate && s.plateMatched === false && (
                <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: "rgba(148,163,184,0.15)", color: "#94A3B8" }}>NEW</span>
              )}
            </div>
            <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{timeAgo(s.submittedAt)}</div>
            {s.activityDescription && (
              <div className="text-xs mt-1 truncate" style={{ color: "var(--text-sec)" }}>{s.activityDescription}</div>
            )}
          </button>
        ))}
      </div>

      {/* Detail panel */}
      {current && !showDispatch && (
        <div className="flex-1">
          <div className="bg-trace-surface rounded-lg p-6 border border-trace-border">
            {/* Header with plate match */}
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-2xl font-mono font-bold tracking-widest">{current.plate || "No plate"}</h3>
                  {isMatch && (
                    <span className="text-xs px-2 py-1 rounded font-semibold" style={{ background: "rgba(220,38,38,0.15)", color: "#DC2626" }}>
                      MATCH
                    </span>
                  )}
                  {isNewPlate && (
                    <span className="text-xs px-2 py-1 rounded font-semibold" style={{ background: "rgba(148,163,184,0.15)", color: "#94A3B8" }}>
                      NEW PLATE
                    </span>
                  )}
                </div>
                <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{timeAgo(current.observedAt)}</p>
              </div>
            </div>

            {/* Matched vehicle info (if plate matched) */}
            {isMatch && current.matchedVehicleId && (
              <div className="mb-4 p-3 rounded-lg" style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.15)" }}>
                <div className="text-xs uppercase tracking-wider font-semibold mb-1" style={{ color: "#DC2626" }}>Known Vehicle</div>
                <p className="text-sm" style={{ color: "var(--text)" }}>
                  This plate is in your database. Review the details and dispatch patrollers if needed.
                </p>
              </div>
            )}

            {/* New plate info */}
            {isNewPlate && (
              <div className="mb-4 p-3 rounded-lg" style={{ background: "rgba(148,163,184,0.06)", border: "1px solid rgba(148,163,184,0.15)" }}>
                <div className="text-xs uppercase tracking-wider font-semibold mb-1" style={{ color: "#94A3B8" }}>New Plate</div>
                <p className="text-sm" style={{ color: "var(--text-sec)" }}>
                  This plate is not in your database. You can add it to tracking or dismiss and notify the reporter.
                </p>
              </div>
            )}

            {/* Sighting details */}
            {current.activityDescription && (
              <div className="mb-4">
                <label className="text-xs uppercase tracking-wider" style={{ color: "var(--text-sec)" }}>Activity</label>
                <p className="mt-1 text-sm">{current.activityDescription}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              {current.direction && (
                <div>
                  <label className="text-xs uppercase tracking-wider" style={{ color: "var(--text-sec)" }}>Direction</label>
                  <p className="mt-1 font-semibold">{current.direction}</p>
                </div>
              )}
              {current.lat && (
                <div>
                  <label className="text-xs uppercase tracking-wider" style={{ color: "var(--text-sec)" }}>Location</label>
                  <p className="mt-1 font-mono text-xs">{current.lat.toFixed(4)}, {current.lng?.toFixed(4)}</p>
                </div>
              )}
            </div>

            {current.notes && (
              <div className="mb-4">
                <label className="text-xs uppercase tracking-wider" style={{ color: "var(--text-sec)" }}>Notes</label>
                <p className="mt-1 text-sm" style={{ color: "var(--text-sec)" }}>{current.notes}</p>
              </div>
            )}

            {/* Photos */}
            {photos.length > 0 && (
              <div className="mb-4">
                <label className="text-xs uppercase tracking-wider" style={{ color: "var(--text-sec)" }}>Photos ({photos.length})</label>
                <div className="flex gap-2 mt-2 overflow-x-auto">
                  {photos.map((p: any) => (
                    <img key={p.id}
                      src={`data:${p.mimeType || "image/jpeg"};base64,${p.photoData}`}
                      alt="Sighting photo"
                      className="rounded-lg border border-trace-border cursor-pointer hover:opacity-80 transition"
                      style={{ height: 120, maxWidth: 200, objectFit: "cover" }}
                      onClick={() => window.open(`data:${p.mimeType || "image/jpeg"};base64,${p.photoData}`, "_blank")}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* --- Dispatch Actions --- */}
            <div className="pt-4 space-y-3" style={{ borderTop: "1px solid var(--border)" }}>
              {/* Primary actions */}
              <div className="flex gap-3">
                {isMatch && (
                  <button onClick={handleConfirmAndDispatch}
                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition hover:opacity-90"
                    style={{ background: "#DC2626", color: "#fff", minHeight: 44 }}
                    title="Confirm this sighting and send patrollers to the location">
                    <Icon name="zap" size={14} /> Confirm & Dispatch <span className="text-xs opacity-60">[C]</span>
                  </button>
                )}
                {isNewPlate && (
                  <button onClick={handleAddToTracking}
                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition hover:opacity-90"
                    style={{ background: "var(--accent)", color: "var(--accent-text)", minHeight: 44 }}
                    title="Add this plate to your vehicle database and optionally dispatch">
                    <Icon name="plus" size={14} /> Add to Tracking
                  </button>
                )}
                {!isMatch && !isNewPlate && (
                  <button onClick={handleConfirmAndDispatch}
                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition hover:opacity-90"
                    style={{ background: "var(--accent)", color: "var(--accent-text)", minHeight: 44 }}
                    title="Create a dispatch for this sighting">
                    <Icon name="zap" size={14} /> Dispatch <span className="text-xs opacity-60">[C]</span>
                  </button>
                )}
              </div>
              {/* Secondary actions */}
              <div className="flex gap-3">
                <button onClick={handleDismissAndNotify}
                  className="flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition"
                  style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-sec)", minHeight: 40 }}
                  title="Mark as reviewed and tell the reporter this vehicle is not a concern">
                  <Icon name="x" size={12} /> Dismiss & Notify <span className="opacity-50">[D]</span>
                </button>
                <button onClick={handleFlag}
                  className="flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition"
                  style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--warning)", minHeight: 40 }}
                  title="Keep in the queue for follow-up later">
                  <Icon name="alert-triangle" size={12} /> Flag <span className="opacity-50">[F]</span>
                </button>
              </div>
              <p className="text-[10px] mt-2" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
                Keyboard: C = confirm & dispatch · D = dismiss · F = flag · N/P = next/previous
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Dispatch panel (slide-in) */}
      {current && showDispatch && (
        <div className="flex-1">
          <DispatchPanel
            sighting={current}
            reporters={reporters}
            eventTypes={eventTypes}
            onSend={handleDispatchSend}
            onCancel={() => setShowDispatch(false)}
          />
        </div>
      )}
    </div>
  );
}

// --- Dispatch Panel ---
function DispatchPanel({ sighting, reporters, eventTypes, onSend, onCancel }: {
  sighting: any;
  reporters: any[];
  eventTypes: any[];
  onSend: (data: any) => void;
  onCancel: () => void;
}) {
  const [selectedReporters, setSelectedReporters] = useState<string[]>([]);
  const [eventTypeId, setEventTypeId] = useState(eventTypes[0]?.id || "");
  const [priority, setPriority] = useState<string>(sighting.plateMatched ? "urgent" : "routine");
  const [notes, setNotes] = useState(sighting.activityDescription || "");
  const [sending, setSending] = useState(false);

  const toggleReporter = (id: string) => {
    setSelectedReporters((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedReporters(reporters.map((r) => r.id));
  };

  const handleSend = async () => {
    if (selectedReporters.length === 0) return;
    setSending(true);
    await onSend({ reporterIds: selectedReporters, eventTypeId, priority, notes });
    setSending(false);
  };

  return (
    <div className="bg-trace-surface rounded-lg p-6 border border-trace-border">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Dispatch Patrollers</h3>
        <button onClick={onCancel} className="p-1 rounded" style={{ color: "var(--text-muted)" }}>
          <Icon name="x" size={18} />
        </button>
      </div>
      <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
        Select patrollers to send to this location. They will receive a notification with the details below.
      </p>

      {/* Sighting summary */}
      <div className="mb-4 p-3 rounded-lg" style={{ background: "var(--bg)" }}>
        <div className="font-mono font-bold tracking-wider">{sighting.plate || "No plate"}</div>
        <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          {sighting.lat?.toFixed(4)}, {sighting.lng?.toFixed(4)}
        </div>
      </div>

      {/* Event type */}
      {eventTypes.length > 0 && (
        <div className="mb-4">
          <label className="text-xs mb-1.5 block" style={{ color: "var(--text-muted)" }}>What type of event is this?</label>
          <select value={eventTypeId} onChange={(e) => setEventTypeId(e.target.value)}
            className="w-full bg-trace-bg border border-trace-border rounded-lg px-3 py-2 text-sm"
            style={{ colorScheme: "dark" }}>
            {eventTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Priority */}
      <div className="mb-4">
        <label className="text-xs mb-1.5 block" style={{ color: "var(--text-muted)" }}>How urgent is this?</label>
        <div className="flex gap-2">
          {[
            { key: "urgent", label: "Urgent", color: "#DC2626" },
            { key: "routine", label: "Routine", color: "#D97706" },
            { key: "info", label: "Info", color: "#64748B" },
          ].map((p) => (
            <button key={p.key} onClick={() => setPriority(p.key)}
              className="flex-1 py-1.5 rounded text-xs font-medium transition"
              style={{
                background: priority === p.key ? p.color : "var(--bg)",
                color: priority === p.key ? "#fff" : "var(--text-sec)",
                border: `1px solid ${priority === p.key ? p.color : "var(--border)"}`,
              }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="mb-4">
        <label className="text-xs mb-1.5 block" style={{ color: "var(--text-muted)" }}>What should patrollers look for?</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
          className="w-full bg-trace-bg border border-trace-border rounded-lg px-3 py-2 text-sm"
          placeholder="Vehicle description, location details, what to look for..." />
      </div>

      {/* Reporter selection */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1.5">
          <label className="text-xs" style={{ color: "var(--text-muted)" }}>Who should respond?</label>
          <button onClick={selectAll} className="text-xs" style={{ color: "var(--accent)" }}>Select all</button>
        </div>
        {reporters.length === 0 ? (
          <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>No active reporters. Generate invite codes in Admin.</p>
        ) : (
          <div className="space-y-1.5 max-h-40 overflow-auto">
            {reporters.map((r) => (
              <button key={r.id} onClick={() => toggleReporter(r.id)}
                className="w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 transition"
                style={{
                  background: selectedReporters.includes(r.id) ? "var(--accent-soft)" : "var(--bg)",
                  border: selectedReporters.includes(r.id) ? "1px solid var(--accent)" : "1px solid var(--border)",
                }}>
                <span className="w-4 h-4 rounded border flex items-center justify-center text-[10px]" style={{
                  borderColor: selectedReporters.includes(r.id) ? "var(--accent)" : "var(--border)",
                  background: selectedReporters.includes(r.id) ? "var(--accent)" : "transparent",
                  color: selectedReporters.includes(r.id) ? "#fff" : "transparent",
                }}>✓</span>
                <span>{r.callsign || r.alias || r.id.slice(0, 8)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Send */}
      <button onClick={handleSend} disabled={sending || selectedReporters.length === 0}
        className="w-full py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50"
        style={{ background: priority === "urgent" ? "#DC2626" : "var(--accent)", color: "#fff", minHeight: 44 }}>
        {sending ? "Sending..." : `Dispatch ${selectedReporters.length} patroller${selectedReporters.length !== 1 ? "s" : ""}`}
      </button>
    </div>
  );
}
