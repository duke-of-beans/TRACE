/**
 * TRACE PWA — Dead Man's Switch + Background Heartbeat
 *
 * Three-layer check-in system:
 * 1. Service Worker periodic sync (every 6h, Chrome/Edge Android)
 * 2. In-app heartbeat poll (every 5min when app is open)
 * 3. TTL countdown with grace period before wipe
 *
 * Default TTL: 72 hours (configurable by operator)
 * Grace period: 4 hours of warnings before auto-wipe
 */

const TTL_KEY = "trace_ttl_hours";
const LAST_CHECKIN_KEY = "trace_last_checkin";
const DEFAULT_TTL_HOURS = 72;
const GRACE_HOURS = 4;

export function getTTLHours(): number {
  return parseInt(localStorage.getItem(TTL_KEY) || String(DEFAULT_TTL_HOURS));
}

export function getLastCheckin(): number {
  return parseInt(localStorage.getItem(LAST_CHECKIN_KEY) || "0");
}

function recordCheckin(): void {
  localStorage.setItem(LAST_CHECKIN_KEY, String(Date.now()));
}

/**
 * Check if the dead man's switch should fire.
 * Returns: "ok" | "warning" | "expired"
 */
export function checkTTLStatus(): "ok" | "warning" | "expired" {
  const lastCheckin = getLastCheckin();
  if (lastCheckin === 0) return "ok"; // never checked in yet (fresh install)

  const ttlMs = getTTLHours() * 3600000;
  const graceMs = GRACE_HOURS * 3600000;
  const elapsed = Date.now() - lastCheckin;

  if (elapsed > ttlMs) return "expired";
  if (elapsed > ttlMs - graceMs) return "warning";
  return "ok";
}

export function hoursUntilExpiry(): number {
  const lastCheckin = getLastCheckin();
  if (lastCheckin === 0) return getTTLHours();
  const ttlMs = getTTLHours() * 3600000;
  const remaining = ttlMs - (Date.now() - lastCheckin);
  return Math.max(0, Math.round(remaining / 3600000));
}

/**
 * Start the dead man's switch monitoring.
 * Checks TTL status and triggers wipe if expired.
 */
export function startDeadManSwitch(): void {
  const status = checkTTLStatus();
  if (status === "expired") {
    import("./panic.js").then(({ panic }) => panic());
    return;
  }
}

/**
 * Background heartbeat — pings the server, records successful check-in.
 * Checks for kill signal in response header.
 */
export async function heartbeat(apiBase: string): Promise<boolean> {
  try {
    const token = localStorage.getItem("trace_token");
    const res = await fetch(`${apiBase}/auth/status`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (res.ok) {
      recordCheckin();

      // check for kill signal
      if (res.headers.get("x-trace-kill") === "true") {
        const { panic } = await import("./panic.js");
        panic();
        return false;
      }
      return true;
    }
    return false;
  } catch {
    // offline — don't update checkin, TTL continues counting down
    return false;
  }
}

/**
 * Start periodic heartbeat polling.
 * Runs every 5 minutes when app is open.
 */
export function startHeartbeat(apiBase: string): void {
  // immediate first heartbeat
  heartbeat(apiBase);

  // poll every 5 minutes
  setInterval(() => heartbeat(apiBase), 5 * 60 * 1000);
}

/**
 * Register Service Worker background sync for heartbeat.
 * This allows check-ins even when the app is closed (Chrome/Edge Android).
 */
export async function registerBackgroundSync(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;

  try {
    const reg = await navigator.serviceWorker.ready;

    // Periodic Background Sync (Chrome 80+, Android only)
    if ("periodicSync" in reg) {
      try {
        const status = await navigator.permissions.query({ name: "periodic-background-sync" as any });
        if (status.state === "granted") {
          await (reg as any).periodicSync.register("trace-heartbeat", {
            minInterval: 6 * 60 * 60 * 1000, // every 6 hours
          });
          console.log("[TRACE] Background sync registered (6h interval)");
        }
      } catch {
        // periodic sync not supported or denied
      }
    }

    // Regular Background Sync (fires when connectivity is restored)
    if ("sync" in reg) {
      try {
        await reg.sync.register("trace-heartbeat-once");
      } catch {}
    }
  } catch {}
}
