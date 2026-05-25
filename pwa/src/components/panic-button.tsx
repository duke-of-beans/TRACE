/**
 * TRACE PWA — Panic Button Component
 *
 * Always accessible. Two-step activation to prevent accidents:
 * 1. Tap the panic zone (bottom of settings)
 * 2. Confirm with a 3-second hold on the destroy button
 *
 * Executes full self-destruct: encryption key, all data,
 * service worker, caches, navigation away.
 */
import { useState, useRef, useCallback } from "preact/hooks";
import { panic } from "../lib/panic.js";

export function PanicButton() {
  const [armed, setArmed] = useState(false);
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const HOLD_DURATION = 3000; // 3 seconds to confirm

  const startHold = useCallback(() => {
    setHolding(true);
    setProgress(0);
    const start = Date.now();

    holdTimer.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(elapsed / HOLD_DURATION, 1);
      setProgress(pct);

      if (pct >= 1) {
        if (holdTimer.current) clearInterval(holdTimer.current);
        // EXECUTE
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
      <div style={{ marginTop: 32, borderTop: "1px solid #2a2a3e", paddingTop: 16 }}>
        <button
          onClick={() => setArmed(true)}
          style={{
            width: "100%", padding: 12,
            background: "transparent", border: "1px solid #e74c3c30",
            borderRadius: 8, color: "#e74c3c", fontSize: 13,
            cursor: "pointer", opacity: 0.6,
          }}
        >
          Emergency Wipe
        </button>
        <p style={{ fontSize: 10, color: "#555", marginTop: 6, textAlign: "center" }}>
          Destroys all TRACE data on this device
        </p>
      </div>
    );
  }

  return (
    <div style={{
      marginTop: 32, padding: 16,
      background: "#1a0a0a", border: "1px solid #e74c3c",
      borderRadius: 8,
    }}>
      <p style={{ color: "#e74c3c", fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
        EMERGENCY WIPE
      </p>
      <p style={{ color: "#888", fontSize: 12, marginBottom: 16, lineHeight: 1.5 }}>
        This will permanently destroy all TRACE data on this device:
        queue, photos, session, encryption keys, cached app data.
        The app will cease to exist. This cannot be undone.
      </p>

      <div style={{ position: "relative", marginBottom: 12 }}>
        <button
          onMouseDown={startHold}
          onMouseUp={cancelHold}
          onMouseLeave={cancelHold}
          onTouchStart={startHold}
          onTouchEnd={cancelHold}
          style={{
            width: "100%", padding: 16,
            background: holding ? `linear-gradient(90deg, #e74c3c ${progress * 100}%, #3a1a1a ${progress * 100}%)` : "#3a1a1a",
            border: "2px solid #e74c3c",
            borderRadius: 8, color: "#fff", fontSize: 16,
            fontWeight: 700, cursor: "pointer",
            letterSpacing: 2,
          }}
        >
          {holding ? `HOLD ${Math.ceil(3 - progress * 3)}s...` : "HOLD TO DESTROY"}
        </button>
      </div>

      <button
        onClick={() => setArmed(false)}
        style={{
          width: "100%", padding: 8,
          background: "transparent", border: "none",
          color: "#666", fontSize: 12, cursor: "pointer",
        }}
      >
        Cancel
      </button>
    </div>
  );
}
