/**
 * TRACE — Vehicle Sunset Service
 *
 * Automatically retires vehicles with no sightings within the
 * chapter's sunset window (default 90 days). Soft retirement -
 * vehicles remain searchable but drop from active dashboards.
 * One-click reactivation if a vehicle reappears.
 */
import { opsDb } from "../db/connection.js";
import {
  vehicles, chapters, sightings, vehicleConcernHistory, concernLevels,
} from "../db/schema/vault-a.js";
import { eq, and, lt, isNull, sql, or } from "drizzle-orm";

/**
 * Run the sunset check for all chapters.
 * Called on a schedule (e.g. daily cron).
 */
export async function runSunsetCheck(): Promise<{
  chaptersChecked: number;
  vehiclesRetired: number;
}> {
  const allChapters = await opsDb.select().from(chapters);
  let totalRetired = 0;

  for (const chapter of allChapters) {
    const sunsetDays = chapter.sunsetDays || 90;
    const cutoff = new Date(Date.now() - sunsetDays * 86400000);

    // find active vehicles with last sighting before cutoff
    // or vehicles that have never been sighted and were created before cutoff
    const staleVehicles = await opsDb
      .select({ id: vehicles.id, lastSeenAt: vehicles.lastSeenAt })
      .from(vehicles)
      .where(
        and(
          eq(vehicles.chapterId, chapter.id),
          eq(vehicles.status, "active"),
          or(
            lt(vehicles.lastSeenAt, cutoff),
            and(isNull(vehicles.lastSeenAt), lt(vehicles.createdAt, cutoff))
          )
        )
      );

    if (staleVehicles.length === 0) continue;

    // find the "Retired" suspicion level for this chapter
    const [retiredLevel] = await opsDb
      .select()
      .from(concernLevels)
      .where(
        and(
          eq(concernLevels.chapterId, chapter.id),
          eq(concernLevels.rank, 0) // retired = rank 0
        )
      )
      .limit(1);

    for (const v of staleVehicles) {
      await opsDb
        .update(vehicles)
        .set({
          status: "retired",
          retiredAt: new Date(),
          suspicionLevelId: retiredLevel?.id || null,
          updatedAt: new Date(),
        })
        .where(eq(vehicles.id, v.id));

      // log retirement to suspicion history
      await opsDb.insert(vehicleConcernHistory).values({
        vehicleId: v.id,
        fromLevelId: null,
        toLevelId: retiredLevel?.id || v.id, // fallback
        reason: `Auto-retired: no sightings in ${sunsetDays} days`,
        changedBy: "system",
        changedByRole: "system",
      });

      totalRetired++;
    }
  }

  return { chaptersChecked: allChapters.length, vehiclesRetired: totalRetired };
}

/**
 * Reactivate a retired vehicle. One-click from operator UI.
 */
export async function reactivateVehicle(
  vehicleId: string,
  operatorId: string
): Promise<void> {
  await opsDb
    .update(vehicles)
    .set({
      status: "active",
      retiredAt: null,
      updatedAt: new Date(),
    })
    .where(eq(vehicles.id, vehicleId));

  await opsDb.insert(vehicleConcernHistory).values({
    vehicleId,
    fromLevelId: null,
    toLevelId: vehicleId, // placeholder - should resolve to "Noticed" level
    reason: "Reactivated by operator",
    changedBy: operatorId,
    changedByRole: "operator",
  });
}
