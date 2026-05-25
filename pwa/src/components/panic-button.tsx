/**
 * TRACE PWA — Panic Button Component
 */
import { useState, useRef, useCallback } from "preact/hooks";
import { panic } from "../lib/panic.js";
import { Icon } from "./icon.js";

export function PanicButton() {
  const [armed, setArmed] = useState(false);
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const HOLD_DURATION = 3000;

  const startHold = useCallback(() => {
    setHolding(true);
    setProgress(0);
    const start = Date.now();
    holdTimer.current = setInterval(() => {
      const pct = Math.min((Date.now() - start) / HOLD_DURATION, 1);
      setProgress(pct);
      if (pct >= 1) {
        if (holdTimer.current) clearInterval(holdTimer.current);
        panic();
      }
    }, 50);
  }, []);

  const cancelHold = useCallback(() => {
    if (holdTimer.current) clearInterval(holdTimer.current);
    setHolding(false);
    setProgress(0);
  }, []);

  if (!armed) {
    return (
      <div class="panic-zone">
        <button class="btn btn-ghost btn-full" onClick={() => setArmed(true)}
          style={{ color: "var(--danger)", justifyContent: "flex-start" }}>
          <Icon name="alert-triangle" size={16} />
          Emergency Wipe
        </button>
        <p class="hint-text" style={{ textAlign: "center" }}>Destroys all TRACE data on this device</p>
      </div>
    );
  }

  return (
    <div class="panic-armed">
      <p style={{ color: "var(--danger)", fontSize: "var(--text-sm)", fontWeight: 700, marginBottom: "var(--sp-2)" }}>
        EMERGENCY WIPE
      </p>
      <p style={{ color: "var(--text-sec)", fontSize: "var(--text-xs)", marginBottom: "var(--sp-4)", lineHeight: "var(--leading-relaxed)" }}>
        This will permanently destroy all TRACE data on this device: queue, photos, session, encryption keys, cached app data. This cannot be undone.
      </p>
      <button
        onMouseDown={startHold} onMouseUp={cancelHold} onMouseLeave={cancelHold}
        onTouchStart={startHold} onTouchEnd={cancelHold}
        class="panic-hold-btn"
        style={{
          background: holding
            ? `linear-gradient(90deg, var(--danger) ${progress * 100}%, var(--danger-soft) ${progress * 100}%)`
            : "var(--danger-soft)",
        }}
      >
        {holding ? `HOLD ${Math.ceil(3 - progress * 3)}s...` : "HOLD TO DESTROY"}
      </button>
      <button class="btn btn-ghost btn-full" onClick={() => setArmed(false)} style={{ marginTop: "var(--sp-2)" }}>
        Cancel
      </button>
    </div>
  );
}
