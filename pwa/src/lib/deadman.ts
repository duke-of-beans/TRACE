/**
 * TRACE PWA — Dead Man's Switch + Remote Kill Receiver
 *
 * Dead man's switch: if the app doesn't check in with the server
 * within a configurable window, it self-destructs. Handles the
 * scenario where a phone is seized and kept offline to prevent
 * remote kill.
 *
 * Remote kill: listens for kill commands via:
 * 1. Push notification (service worker)
 * 2. API response header (on any sync attempt)
 * 3. Periodic heartbeat check
 */
import { panic } from "./panic.js";

const LAST_CHECKIN_KEY = "trace_last_checkin";
const KILL_CHECK_INTERVAL = 60000; // check every 60 seconds
const DEFAULT_TTL_HOURS = 24; // default: self-destruct after 24h without check-in

/**
 * Record a successful server check-in.
 * Called after every successful API response.
 */
export function recordCheckin(): void {
  localStorage.setItem(LAST_CHECKIN_KEY, Date.now().toString());
}

/**
 * Get configured TTL in milliseconds.
 */
function getTTL(): number {
  const hours = parseInt(localStorage.getItem("trace_ttl_hours") || String(DEFAULT_TTL_HOURS));
  return hours * 60 * 60 * 1000;
}

/**
 * Check if the dead man's switch should fire.
 */
function shouldSelfDestruct(): boolean {
  const lastCheckin = localStorage.getItem(LAST_CHECKIN_KEY);
  if (!lastCheckin) return false; // never checked in = first run, don't destroy

  const elapsed = Date.now() - parseInt(lastCheckin);
  return elapsed > getTTL();
}

/**
 * Check for remote kill flag in API response.
 * Call this on every API response.
 */
export function checkKillSignal(response: Response): boolean {
  const killHeader = response.headers.get("x-trace-kill");
  if (killHeader === "true") {
    console.log("[DEAD MAN] Remote kill signal received");
    panic();
    return true;
  }

  // successful response = valid check-in
  if (response.ok) {
    recordCheckin();
  }

  return false;
}

/**
 * Start the dead man's switch timer.
 * Runs periodic checks and self-destructs if overdue.
 */
export function startDeadManSwitch(): void {
  // initial check
  if (shouldSelfDestruct()) {
    console.log("[DEAD MAN] TTL exceeded, self-destructing");
    panic();
    return;
  }

  // periodic check
  setInterval(() => {
    if (shouldSelfDestruct()) {
      console.log("[DEAD MAN] TTL exceeded, self-destructing");
      panic();
    }
  }, KILL_CHECK_INTERVAL);

  // record initial check-in if first run
  if (!localStorage.getItem(LAST_CHECKIN_KEY)) {
    recordCheckin();
  }
}

/**
 * Heartbeat: ping the server to check for kill signal.
 * Also serves as a check-in for the dead man's switch.
 */
export async function heartbeat(apiBase: string, token: string | null): Promise<void> {
  try {
    const res = await fetch(`${apiBase}/health`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (checkKillSignal(res)) return; // killed

    // check for reporter-specific kill
    if (token) {
      const killRes = await fetch(`${apiBase}/auth/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      checkKillSignal(killRes);
    }
  } catch {
    // server unreachable — dead man's switch clock is ticking
  }
}

/**
 * Start periodic heartbeat. Checks every 5 minutes.
 */
export function startHeartbeat(apiBase: string): void {
  const token = localStorage.getItem("trace_token");

  // immediate check
  heartbeat(apiBase, token).catch(() => {});

  // periodic
  setInterval(() => {
    const t = localStorage.getItem("trace_token");
    heartbeat(apiBase, t).catch(() => {});
  }, 5 * 60 * 1000);
}
