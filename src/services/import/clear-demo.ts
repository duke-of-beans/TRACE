/**
 * TRACE — Demo Data Cleanup
 *
 * Removes all seed/demo data before first real import.
 * Identifies demo data by the "DEMO" / "FAKE" / "TEST" prefixes
 * used in the seed script. Also clears sightings, actors, and
 * type assignments linked to demo vehicles.
 *
 * Run this ONCE before the first real data import. After clearing,
 * tags, suspicion levels, dispatch event types, and reporters
 * remain (they are chapter config, not demo data).
 */
import { opsDb } from "../../db/connection.js";
import {
  vehicles, sightings, actors, actorVehicles,
  actorIdentifiers, actorPhotos, vehicleTypeAssignments,
  vehicleConcernHistory, actorConcernHistory,
  sightingPhotos, sightingFeedback,
  dispatchEvents, dispatchAssignments, dispatchOutcomes,
  incidentVehicles, incidentActors, incidents, incidentEvidence,
} from "../../db/schema/vault-a.js";
import { eq, or, ilike, sql } from "drizzle-orm";

export type ClearResult = {
  sightingsCleared: number;
  vehiclesCleared: number;
  actorsCleared: number;
  dispatchCleared: number;
};

/**
 * Check if the chapter has demo data (DEMO/FAKE/TEST prefixed records).
 */
export async function hasDemoData(chapterId: string): Promise<boolean> {
  const [result] = await opsDb.execute(
    sql`SELECT COUNT(*) as cnt FROM ops.vehicles
        WHERE chapter_id = ${chapterId}
        AND (description ILIKE 'DEMO:%' OR plate ILIKE 'DEMO-%' OR plate ILIKE 'FAKE-%' OR plate ILIKE 'TEST-%')`
  );
  return Number((result as any).cnt) > 0;
}

/**
 * Clear all demo/seed data from a chapter.
 * Preserves: chapter config, reporters, suspicion levels,
 * vehicle types, dispatch event types, tag definitions.
 */
export async function clearDemoData(chapterId: string): Promise<ClearResult> {
  const result: ClearResult = {
    sightingsCleared: 0,
    vehiclesCleared: 0,
    actorsCleared: 0,
    dispatchCleared: 0,
  };

  // 1. Find demo vehicles
  const demoVehicles = await opsDb
    .select({ id: vehicles.id })
    .from(vehicles)
    .where(
      sql`${vehicles.chapterId} = ${chapterId}
        AND (${vehicles.description} ILIKE 'DEMO:%'
          OR ${vehicles.plate} ILIKE 'DEMO-%'
          OR ${vehicles.plate} ILIKE 'FAKE-%'
          OR ${vehicles.plate} ILIKE 'TEST-%')`
    );

  const vehicleIds = demoVehicles.map((v) => v.id);

  // 2. Find demo actors
  const demoActors = await opsDb
    .select({ id: actors.id })
    .from(actors)
    .where(
      sql`${actors.chapterId} = ${chapterId}
        AND (${actors.alias} ILIKE '%(DEMO)%')`
    );

  const actorIds = demoActors.map((a) => a.id);

  // 3. Clear sightings linked to demo vehicles (and their photos/feedback)
  if (vehicleIds.length > 0) {
    const demoSightings = await opsDb
      .select({ id: sightings.id })
      .from(sightings)
      .where(
        sql`${sightings.chapterId} = ${chapterId}
          AND (${sightings.vehicleId} IN (${sql.join(vehicleIds.map(id => sql`${id}`), sql`, `)})
            OR ${sightings.activityDescription} ILIKE 'DEMO:%'
            OR ${sightings.plate} ILIKE 'FAKE-%'
            OR ${sightings.plate} ILIKE 'TEST-%')`
      );

    const sightingIds = demoSightings.map((s) => s.id);

    for (const sid of sightingIds) {
      await opsDb.delete(sightingPhotos).where(eq(sightingPhotos.sightingId, sid));
      await opsDb.delete(sightingFeedback).where(eq(sightingFeedback.sightingId, sid));
    }

    // Clear dispatch data linked to demo sightings
    for (const sid of sightingIds) {
      const dispatches = await opsDb
        .select({ id: dispatchEvents.id })
        .from(dispatchEvents)
        .where(eq(dispatchEvents.sightingId, sid));

      for (const d of dispatches) {
        await opsDb.delete(dispatchOutcomes).where(eq(dispatchOutcomes.dispatchEventId, d.id));
        await opsDb.delete(dispatchAssignments).where(eq(dispatchAssignments.dispatchEventId, d.id));
        await opsDb.delete(dispatchEvents).where(eq(dispatchEvents.id, d.id));
        result.dispatchCleared++;
      }
    }

    for (const sid of sightingIds) {
      await opsDb.delete(sightings).where(eq(sightings.id, sid));
      result.sightingsCleared++;
    }
  }

  // 4. Clear incident links to demo vehicles and actors
  for (const vid of vehicleIds) {
    await opsDb.delete(incidentVehicles).where(eq(incidentVehicles.vehicleId, vid));
  }
  for (const aid of actorIds) {
    await opsDb.delete(incidentActors).where(eq(incidentActors.actorId, aid));
  }

  // 5. Clear actor data
  for (const aid of actorIds) {
    await opsDb.delete(actorIdentifiers).where(eq(actorIdentifiers.actorId, aid));
    await opsDb.delete(actorVehicles).where(eq(actorVehicles.actorId, aid));
    await opsDb.delete(actorPhotos).where(eq(actorPhotos.actorId, aid));
    await opsDb.delete(actorConcernHistory).where(eq(actorConcernHistory.actorId, aid));
    await opsDb.delete(actors).where(eq(actors.id, aid));
    result.actorsCleared++;
  }

  // 6. Clear vehicles
  for (const vid of vehicleIds) {
    await opsDb.delete(vehicleTypeAssignments).where(eq(vehicleTypeAssignments.vehicleId, vid));
    await opsDb.delete(vehicleConcernHistory).where(eq(vehicleConcernHistory.vehicleId, vid));
    await opsDb.delete(actorVehicles).where(eq(actorVehicles.vehicleId, vid));
    await opsDb.delete(vehicles).where(eq(vehicles.id, vid));
    result.vehiclesCleared++;
  }

  return result;
}


/**
 * Refresh demo sighting timestamps to be recent.
 * Distributes them across the last 72 hours so they appear
 * in the Intel Map default 7d view.
 */
export async function refreshDemoTimestamps(chapterId: string): Promise<number> {
  const demoSightings = await opsDb
    .select({ id: sightings.id })
    .from(sightings)
    .where(
      sql`${sightings.chapterId} = ${chapterId} AND (${sightings.plate} ILIKE 'DEMO%' OR ${sightings.plate} ILIKE 'FAKE%' OR ${sightings.plate} ILIKE 'TEST%')`
    );

  const now = Date.now();
  let updated = 0;

  for (let i = 0; i < demoSightings.length; i++) {
    const hoursAgo = Math.floor(Math.random() * 72);
    const minutesAgo = Math.floor(Math.random() * 60);
    const ts = new Date(now - (hoursAgo * 3600000 + minutesAgo * 60000));

    await opsDb.update(sightings).set({
      observedAt: ts,
      submittedAt: new Date(ts.getTime() + 60000),
    }).where(eq(sightings.id, demoSightings[i].id));
    updated++;
  }

  return updated;
}
