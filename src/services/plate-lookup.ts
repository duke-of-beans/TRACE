/**
 * TRACE — Plate Lookup Service
 *
 * Auto-checks a plate against the vehicle database on sighting creation.
 * Returns the matching vehicle (if any) with its suspicion level.
 * The result is stored on the sighting for instant triage display.
 */
import { opsDb } from "../db/connection.js";
import { vehicles, concernLevels } from "../db/schema/vault-a.js";
import { eq, and, ilike } from "drizzle-orm";

export type PlateMatch = {
  matched: boolean;
  vehicle?: {
    id: string;
    plate: string;
    make?: string | null;
    model?: string | null;
    color?: string | null;
    year?: number | null;
    status: string;
    suspicionLevelId?: string | null;
    suspicionLabel?: string | null;
    suspicionRank?: number | null;
    suspicionColor?: string | null;
  };
};

/**
 * Look up a plate in the vehicle database.
 * Case-insensitive, strips whitespace and dashes.
 */
export async function lookupPlate(plate: string, chapterId: string): Promise<PlateMatch> {
  if (!plate || plate.trim().length < 2) return { matched: false };

  const normalized = plate.trim().toUpperCase().replace(/[\s-]/g, "");

  // Search by normalized plate (case-insensitive, ignore dashes/spaces)
  const results = await opsDb
    .select({
      id: vehicles.id,
      plate: vehicles.plate,
      make: vehicles.make,
      model: vehicles.model,
      color: vehicles.color,
      year: vehicles.year,
      status: vehicles.status,
      suspicionLevelId: vehicles.suspicionLevelId,
    })
    .from(vehicles)
    .where(
      and(
        eq(vehicles.chapterId, chapterId),
        eq(vehicles.status, "active")
      )
    )
    .limit(100);

  // Find match by normalized comparison
  const match = results.find((v) => {
    if (!v.plate) return false;
    return v.plate.toUpperCase().replace(/[\s-]/g, "") === normalized;
  });

  if (!match) return { matched: false };

  // Get suspicion level details if assigned
  let suspicionLabel: string | null = null;
  let suspicionRank: number | null = null;
  let suspicionColor: string | null = null;

  if (match.suspicionLevelId) {
    const [level] = await opsDb
      .select()
      .from(concernLevels)
      .where(eq(concernLevels.id, match.suspicionLevelId))
      .limit(1);

    if (level) {
      suspicionLabel = level.label;
      suspicionRank = level.rank;
      suspicionColor = level.color;
    }
  }

  return {
    matched: true,
    vehicle: {
      ...match,
      plate: match.plate || "",
      suspicionLabel,
      suspicionRank,
      suspicionColor,
    },
  };
}

/**
 * Quick plate check — just returns match/no-match with basic info.
 * Used by the reporter's plate check mode.
 */
export async function quickPlateCheck(plate: string, chapterId: string): Promise<{
  found: boolean;
  plate?: string;
  description?: string;
  suspicionLevel?: string;
  lastSeen?: string;
}> {
  const result = await lookupPlate(plate, chapterId);
  if (!result.matched || !result.vehicle) return { found: false };

  const v = result.vehicle;
  return {
    found: true,
    plate: v.plate || undefined,
    description: [v.color, v.year, v.make, v.model].filter(Boolean).join(" ") || undefined,
    suspicionLevel: v.suspicionLabel || undefined,
  };
}
