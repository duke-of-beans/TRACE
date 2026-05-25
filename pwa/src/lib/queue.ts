/**
 * TRACE PWA — Encrypted Offline Queue with Background Retry
 *
 * All sighting data encrypted at rest using device key.
 * Exponential backoff retry when server is unreachable.
 * Queue persists across app restarts until sync or panic.
 */
import { get, set, del, keys } from "idb-keyval";
import { loadDeviceKey, encryptData, decryptData } from "./crypto.js";

const QUEUE_PREFIX = "tq_"; // trace queue
const RETRY_BASE_MS = 5000;
const RETRY_MAX_MS = 300000; // 5 minutes max
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3100/api/v1";

let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryAttempt = 0;
let syncing = false;

export type QueuedSighting = {
  id: string;
  payload: Record<string, unknown>;
  photos: string[]; // encrypted base64
  queuedAt: string;
  retryCount: number;
};

/**
 * Queue a sighting with encryption.
 * Data is encrypted before hitting IndexedDB.
 */
export async function enqueue(sighting: Omit<QueuedSighting, "retryCount">): Promise<void> {
  const key = await loadDeviceKey();
  if (!key) throw new Error("No device key - app may have been wiped");

  const encrypted = await encryptData(key, JSON.stringify({ ...sighting, retryCount: 0 }));
  await set(`${QUEUE_PREFIX}${sighting.id}`, encrypted);
  scheduleRetry(); // kick off sync attempt
}

/**
 * Get count of queued items.
 */
export async function getQueueCount(): Promise<number> {
  const allKeys = await keys();
  return allKeys.filter((k) => String(k).startsWith(QUEUE_PREFIX)).length;
}

/**
 * Attempt to drain the queue. Called on schedule and manually.
 */
export async function drainQueue(): Promise<{ sent: number; failed: number; remaining: number }> {
  if (syncing) return { sent: 0, failed: 0, remaining: await getQueueCount() };
  syncing = true;

  const deviceKey = await loadDeviceKey();
  if (!deviceKey) { syncing = false; return { sent: 0, failed: 0, remaining: 0 }; }

  const token = localStorage.getItem("trace_token");
  const allKeys = await keys();
  const queueKeys = allKeys.filter((k) => String(k).startsWith(QUEUE_PREFIX));

  let sent = 0;
  let failed = 0;

  for (const qKey of queueKeys) {
    try {
      const encrypted = await get(qKey) as string;
      const decrypted = await decryptData(deviceKey, encrypted);
      const sighting = JSON.parse(decrypted) as QueuedSighting;

      const res = await fetch(`${API_BASE}/sightings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(sighting.payload),
      });

      if (res.ok) {
        await del(qKey);
        sent++;
      } else if (res.status >= 400 && res.status < 500) {
        // client error - don't retry, it'll keep failing
        await del(qKey);
        failed++;
      } else {
        // server error - keep in queue for retry
        failed++;
      }
    } catch {
      // network error - server unreachable, keep in queue
      failed++;
    }
  }

  syncing = false;

  const remaining = await getQueueCount();
  if (remaining > 0 && failed > 0) {
    scheduleRetry();
  } else {
    retryAttempt = 0; // reset backoff on success
  }

  return { sent, failed, remaining };
}

/**
 * Schedule a retry with exponential backoff.
 */
function scheduleRetry(): void {
  if (retryTimer) return; // already scheduled

  const delay = Math.min(RETRY_BASE_MS * Math.pow(2, retryAttempt), RETRY_MAX_MS);
  retryAttempt++;

  retryTimer = setTimeout(async () => {
    retryTimer = null;
    const result = await drainQueue();
    if (result.sent > 0) {
      console.log(`[QUEUE] Synced ${result.sent} sighting(s)`);
    }
  }, delay);
}

/**
 * Start background sync loop. Call once on app init.
 * Also listens for online/offline events.
 */
export function startBackgroundSync(): void {
  // try to drain immediately
  drainQueue().catch(() => {});

  // retry when coming back online
  window.addEventListener("online", () => {
    console.log("[QUEUE] Back online, attempting sync...");
    retryAttempt = 0;
    drainQueue().catch(() => {});
  });

  // periodic check every 30 seconds
  setInterval(() => {
    if (navigator.onLine) {
      drainQueue().catch(() => {});
    }
  }, 30000);
}
