/**
 * TRACE PWA — Timing Jitter (client-side)
 *
 * Applied before submission to decorrelate reporter presence
 * from sighting appearance in the system.
 * Server also applies jitter as defense-in-depth.
 */
const JITTER_MS = 30_000; // ±30 seconds

export function applyJitter(timestamp: Date): Date {
  const offset = Math.random() * JITTER_MS * 2 - JITTER_MS;
  return new Date(timestamp.getTime() + offset);
}
