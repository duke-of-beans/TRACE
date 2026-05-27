/**
 * TRACE — Plate Lookup API
 *
 * Two-tier lookup for reporter field intelligence.
 * Tier 1: TRACE database (free, always available)
 * Tier 2: CarAPI (if configured, ~$0.30/lookup)
 *
 * Reporter sees truncated data. Full API response stays server-side.
 */
import { Hono } from "hono";
import { opsDb } from "../../db/connection.js";
import {
  vehicles, sightingPhotos, sightings,
  vehicleEnrichments, tagDefinitions,
} from "../../db/schema/vault-a.js";
import { eq, and, desc, ilike, sql } from "drizzle-orm";
import { lookupPlateCarApi, cacheEnrichment } from "../../services/carapi.js";
import { isIntegrationEnabled } from "../integrations/index.js";

export const platesRouter = new Hono();

// GET /plates/lookup?plate=X&state=Y — two-tier plate lookup
platesRouter.get("/lookup", async (c) => {
  const chapterId = c.req.header("x-chapter-id");
  if (!chapterId) return c.json({ error: "Missing chapter" }, 400);

  const plate = c.req.query("plate")?.trim().toUpperCase().replace(/[\s-]/g, "");
  const state = c.req.query("state")?.trim().toUpperCase() || "";

  if (!plate || plate.length < 2) {
    return c.json({ error: "Plate required (min 2 chars)" }, 400);
  }

  // ─── TIER 1: TRACE Database ───
  const dbVehicles = await opsDb
    .select()
    .from(vehicles)
    .where(and(
      eq(vehicles.chapterId, chapterId),
      eq(vehicles.status, "active"),
    ))
    .limit(200);

  const match = dbVehicles.find((v) => {
    if (!v.plate) return false;
    return v.plate.toUpperCase().replace(/[\s-]/g, "") === plate;
  });

  if (match) {
    // Get vehicle photo (most recent sighting photo)
    const photos = await opsDb
      .select({ photoData: sightingPhotos.photoData })
      .from(sightingPhotos)
      .innerJoin(sightings, eq(sightings.id, sightingPhotos.sightingId))
      .where(eq(sightings.vehicleId, match.id))
      .orderBy(desc(sightingPhotos.createdAt))
      .limit(1);

    // Get vehicle tag (from latest operator tag on any sighting for this vehicle)
    const taggedSighting = await opsDb
      .select({ operatorTag: sightings.operatorTag })
      .from(sightings)
      .where(and(
        eq(sightings.vehicleId, match.id),
        sql`${sightings.operatorTag} IS NOT NULL`,
      ))
      .orderBy(desc(sightings.updatedAt))
      .limit(1);

    // Get suspicion level
    let suspicionLabel: string | null = null;
    let suspicionColor: string | null = null;
    if (match.suspicionLevelId) {
      const { concernLevels } = await import("../../db/schema/vault-a.js");
      const [level] = await opsDb
        .select()
        .from(concernLevels)
        .where(eq(concernLevels.id, match.suspicionLevelId))
        .limit(1);
      if (level) {
        suspicionLabel = level.label;
        suspicionColor = level.color;
      }
    }

    return c.json({
      tier: 1,
      status: "tracked",
      plate: match.plate,
      make: match.make,
      model: match.model,
      year: match.year,
      color: match.color,
      photo: photos[0]?.photoData ? `data:image/jpeg;base64,${photos[0].photoData.slice(0, 200)}...` : null,
      photoAvailable: !!photos[0]?.photoData,
      tag: taggedSighting[0]?.operatorTag || null,
      suspicionLevel: suspicionLabel,
      suspicionColor: suspicionColor,
      description: [match.color, match.year, match.make, match.model]
        .filter(Boolean).join(" ") || null,
    });
  }

  // ─── TIER 2: CarAPI (if configured) ───
  const carapiEnabled = await isIntegrationEnabled(chapterId, "carapi");

  if (carapiEnabled && state) {
    const carResult = await lookupPlateCarApi(plate, state, chapterId);

    if (carResult && carResult.found) {
      // Truncated response for reporter (no VIN, no raw JSON)
      return c.json({
        tier: 2,
        status: "found",
        plate,
        make: carResult.make,
        model: carResult.model,
        year: carResult.year,
        color: carResult.color,
        bodyType: carResult.bodyType,
        description: [carResult.color, carResult.year, carResult.make, carResult.model]
          .filter(Boolean).join(" ") || null,
      });
    }

    if (carResult && !carResult.found) {
      return c.json({
        tier: 2,
        status: "not_found",
        plate,
        message: "No vehicle record found for this plate.",
      });
    }
  }

  // ─── No match, no API ───
  return c.json({
    tier: carapiEnabled ? 2 : 1,
    status: "not_found",
    plate,
    message: carapiEnabled
      ? "No vehicle record found."
      : "Plate not in chapter database.",
    apiAvailable: carapiEnabled,
  });
});

// GET /plates/check-integration — reporter checks if CarAPI is available
platesRouter.get("/check-integration", async (c) => {
  const chapterId = c.req.header("x-chapter-id");
  if (!chapterId) return c.json({ carapi: false });
  const enabled = await isIntegrationEnabled(chapterId, "carapi");
  return c.json({ carapi: enabled });
});
