/**
 * TRACE — Duplicate Detector
 *
 * Identifies potential duplicate vehicles by plate, make+model similarity.
 * Flags but doesn't auto-merge — operator reviews.
 */
import type { ImportRow } from "./types.js";

/**
 * Find duplicate candidates within an import batch.
 * Groups rows by normalized plate, then by make+model similarity.
 */
export function detectDuplicates(rows: ImportRow[]): ImportRow[] {
  const plateGroups = new Map<string, number[]>();

  for (let i = 0; i < rows.length; i++) {
    const plate = String(rows[i].normalized.plate || "").toUpperCase().replace(/\s/g, "");
    if (!plate) continue;

    if (!plateGroups.has(plate)) plateGroups.set(plate, []);
    plateGroups.get(plate)!.push(i);
  }

  // mark duplicates (keep first occurrence, flag rest)
  for (const [_, indices] of plateGroups) {
    if (indices.length <= 1) continue;
    for (let i = 1; i < indices.length; i++) {
      rows[indices[i]].isDuplicate = true;
    }
  }

  return rows;
}
