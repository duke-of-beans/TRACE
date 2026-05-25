/**
 * TRACE — Submission Timing Jitter
 *
 * Applies ±30 second random offset to sighting submission timestamps.
 * Prevents timing correlation attacks where an adversary observes
 * when a reporter is near a vehicle and when a sighting appears in the system.
 *
 * Applied server-side as a defense-in-depth measure.
 * PWA also applies client-side jitter.
 */

const JITTER_RANGE_MS = 30_000; // ±30 seconds

/**
 * Apply timing jitter to a submission timestamp.
 * Returns a new Date offset by a random amount within ±JITTER_RANGE_MS.
 */
export function applyJitter(timestamp: Date): Date {
  const offset = Math.random() * JITTER_RANGE_MS * 2 - JITTER_RANGE_MS;
  return new Date(timestamp.getTime() + offset);
}

/**
 * Determine if jitter should be applied.
 * Jitter is always applied to reporter submissions.
 * Operator-entered data (e.g. from Excel import) may skip jitter.
 */
export function shouldApplyJitter(role: string): boolean {
  return role === "reporter";
}
