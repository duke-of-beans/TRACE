/**
 * TRACE — Database Importer
 *
 * Takes normalized, validated import rows and writes them
 * to the TRACE database. Creates vehicle dossiers from unique
 * plate+make+model combos, sighting records from each row,
 * and actor profiles from driver data.
 */
import "dotenv/config";
import { opsDb } from "../../db/connection.js";
import {
  vehicles, sightings, actors, actorVehicles,
  suspicionLevels, reporters,
} from "../../db/schema/vault-a.js";
import { eq, and } from "drizzle-orm";
import type { ImportRow } from "./types.js";

type ImportResult = {
  vehiclesCreated: number;
  sightingsCreated: number;
  actorsCreated: number;
  skipped: number;
  errors: string[];
};

/**
 * Import validated rows into the database.
 */
export async function importRows(
  rows: ImportRow[],
  chapterId: string,
  operatorId: string
): Promise<ImportResult> {
  const result: ImportResult = {
    vehiclesCreated: 0,
    sightingsCreated: 0,
    actorsCreated: 0,
    skipped: 0,
    errors: [],
  };

  // cache: plate -> vehicleId (avoid duplicate vehicle creation)
  const vehicleCache = new Map<string, string>();
  // cache: alias -> actorId
  const actorCache = new Map<string, string>();

  // get default suspicion level (rank 1 = "Noticed")
  const [defaultLevel] = await opsDb
    .select()
    .from(suspicionLevels)
    .where(and(eq(suspicionLevels.chapterId, chapterId), eq(suspicionLevels.rank, 1)))
    .limit(1);

  for (const row of rows) {
    if (row.errors.length > 0 || row.isDuplicate) {
      result.skipped++;
      continue;
    }

    const n = row.normalized;

    try {
      // --- Vehicle ---
      const plate = String(n.plate || "").toUpperCase().replace(/\s/g, "");
      const vehicleKey = plate || `${n.make}-${n.model}-${n.color}`;
      let vehicleId = vehicleCache.get(vehicleKey);

      if (!vehicleId) {
        // check if vehicle already exists in DB
        if (plate) {
          const [existing] = await opsDb
            .select({ id: vehicles.id })
            .from(vehicles)
            .where(and(eq(vehicles.chapterId, chapterId), eq(vehicles.plate, plate)))
            .limit(1);
          if (existing) vehicleId = existing.id;
        }

        if (!vehicleId) {
          const [created] = await opsDb
            .insert(vehicles)
            .values({
              chapterId,
              plate: plate || null,
              make: n.make ? String(n.make) : null,
              model: n.model ? String(n.model) : null,
              year: n.year ? Number(n.year) : null,
              color: n.color ? String(n.color) : null,
              description: n.vehicleDescription ? String(n.vehicleDescription) : null,
              suspicionLevelId: defaultLevel?.id || null,
            })
            .returning();
          vehicleId = created.id;
          result.vehiclesCreated++;
        }
        vehicleCache.set(vehicleKey, vehicleId);
      }

      // --- Sighting ---
      let observedAt = new Date();
      if (n.observedDate) {
        const dateStr = String(n.observedDate);
        const timeStr = n.observedTime ? String(n.observedTime) : "12:00";
        observedAt = new Date(`${dateStr}T${timeStr}`);
        if (isNaN(observedAt.getTime())) observedAt = new Date();
      }

      const [sighting] = await opsDb
        .insert(sightings)
        .values({
          chapterId,
          reporterId: operatorId,
          vehicleId,
          lat: n.lat ? Number(n.lat) : 0,
          lng: n.lng ? Number(n.lng) : 0,
          locationDescription: n.locationDescription ? String(n.locationDescription) : null,
          observedAt,
          plate: plate || null,
          vehicleDescription: n.vehicleDescription ? String(n.vehicleDescription) : null,
          activityDescription: n.activityDescription ? String(n.activityDescription) : null,
          direction: n.direction ? String(n.direction) : null,
          notes: n.notes ? String(n.notes) : null,
          triaged: true, // imported data is pre-triaged
          triagedBy: operatorId,
          triagedAt: new Date(),
        })
        .returning();

      result.sightingsCreated++;

      // update vehicle lastSeenAt
      await opsDb
        .update(vehicles)
        .set({
          lastSeenAt: observedAt,
          lastSeenLat: n.lat ? Number(n.lat) : null,
          lastSeenLng: n.lng ? Number(n.lng) : null,
          updatedAt: new Date(),
        })
        .where(eq(vehicles.id, vehicleId));

      // --- Actor (if driver data present) ---
      if (n.driverAlias) {
        const alias = String(n.driverAlias);
        let actorId = actorCache.get(alias);

        if (!actorId) {
          const [created] = await opsDb
            .insert(actors)
            .values({
              chapterId,
              alias,
              physicalDescription: n.driverDescription ? String(n.driverDescription) : null,
            })
            .returning();
          actorId = created.id;
          actorCache.set(alias, actorId);
          result.actorsCreated++;
        }

        // link actor to vehicle (ignore conflict if already linked)
        try {
          await opsDb.insert(actorVehicles).values({ actorId, vehicleId });
        } catch { /* already linked */ }
      }

    } catch (err) {
      result.errors.push(`Row ${row.rowNumber}: ${(err as Error).message}`);
    }
  }

  return result;
}
