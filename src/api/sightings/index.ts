/**
 * TRACE API — Sightings
 *
 * The core intake endpoint. Reporter PWA hits this.
 * Must be faster than texting - minimal required fields.
 */
import { Hono } from "hono";
import { z } from "zod";
import { opsDb } from "../../db/connection.js";
import { sightings, sightingPhotos } from "../../db/schema/vault-a.js";
import { eq, desc, and } from "drizzle-orm";
import { emitNewSighting } from "../../services/realtime.js";
import { dispatch } from "../../services/notification.js";
import { applyJitter, shouldApplyJitter } from "../../services/jitter.js";
import { lookupPlate } from "../../services/plate-lookup.js";

export const sightingsRouter = new Hono();

// --- Validation ---
const createSightingSchema = z.object({
  vehicleId: z.string().uuid().optional(),
  lat: z.number(),
  lng: z.number(),
  locationDescription: z.string().optional(),
  observedAt: z.string().datetime(),
  plate: z.string().max(32).optional(),
  vehicleDescription: z.string().optional(),
  activityDescription: z.string().optional(),
  direction: z.string().max(16).optional(),
  notes: z.string().optional(),
});

// --- POST /sightings — submit a new sighting ---
sightingsRouter.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createSightingSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  // TODO: extract chapterId and reporterId from auth context
  const chapterId = c.req.header("x-chapter-id") || "";
  const reporterId = c.req.header("x-reporter-id") || "";

  const role = c.req.header("x-role") || "reporter";
  const observedAt = shouldApplyJitter(role)
    ? applyJitter(new Date(parsed.data.observedAt))
    : new Date(parsed.data.observedAt);

  // Auto plate lookup — check if this plate is in the database
  let plateMatched: boolean | null = null;
  let matchedVehicleId: string | undefined;

  if (parsed.data.plate) {
    const match = await lookupPlate(parsed.data.plate, chapterId);
    plateMatched = match.matched;
    matchedVehicleId = match.vehicle?.id;
  }

  const [sighting] = await opsDb
    .insert(sightings)
    .values({
      chapterId,
      reporterId,
      ...parsed.data,
      observedAt,
      jitterApplied: shouldApplyJitter(role),
      plateMatched,
      matchedVehicleId,
      vehicleId: parsed.data.vehicleId || matchedVehicleId,
    })
    .returning();

  // real-time: push to operator triage queue
  emitNewSighting(chapterId, sighting);

  // Store photos if provided (base64-encoded)
  if (body.photos && Array.isArray(body.photos)) {
    for (let i = 0; i < body.photos.length && i < 5; i++) {
      const photo = body.photos[i];
      if (photo?.data) {
        await opsDb.insert(sightingPhotos).values({
          sightingId: sighting.id,
          photoData: photo.data,
          mimeType: photo.mimeType || "image/jpeg",
          exifLat: photo.lat || null,
          exifLng: photo.lng || null,
          sortOrder: i,
        });
      }
    }
  }

  // push notifications
  dispatch({
    event: "new_sighting",
    chapterId,
    data: { vehicleId: parsed.data.vehicleId },
  }).catch(() => {}); // fire and forget

  return c.json(sighting, 201);
});

// --- GET /sightings — list sightings (operator triage queue or reporter history) ---
sightingsRouter.get("/", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";
  const reporterId = c.req.query("reporterId") || c.req.header("x-reporter-id") || "";
  const untriaged = c.req.query("untriaged") === "true";
  const vehicleId = c.req.query("vehicleId");

  const conditions = [eq(sightings.chapterId, chapterId)];
  if (untriaged) conditions.push(eq(sightings.triaged, false));
  if (reporterId) conditions.push(eq(sightings.reporterId, reporterId));
  if (vehicleId) conditions.push(eq(sightings.vehicleId, vehicleId));

  const results = await opsDb
    .select()
    .from(sightings)
    .where(and(...conditions))
    .orderBy(desc(sightings.submittedAt))
    .limit(100);

  return c.json(results);
});

// --- GET /sightings/:id ---
sightingsRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [sighting] = await opsDb
    .select()
    .from(sightings)
    .where(eq(sightings.id, id))
    .limit(1);

  if (!sighting) return c.json({ error: "Not found" }, 404);
  return c.json(sighting);
});

// --- PATCH /sightings/:id/triage — mark sighting as triaged ---
sightingsRouter.patch("/:id/triage", async (c) => {
  const id = c.req.param("id");
  const { action } = await c.req.json(); // approve, dismiss, flag, escalate
  const triagedBy = c.req.header("x-reporter-id") || "";

  const [updated] = await opsDb
    .update(sightings)
    .set({
      triaged: true,
      triagedBy,
      triagedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(sightings.id, id))
    .returning();

  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json({ ...updated, triageAction: action });
});

// --- GET /sightings/plate-check?plate=ABC1234 — quick plate check ---
sightingsRouter.get("/plate-check", async (c) => {
  const plate = c.req.query("plate");
  if (!plate || plate.length < 2) return c.json({ found: false });
  const chapterId = c.req.header("x-chapter-id") || "";
  const { quickPlateCheck } = await import("../../services/plate-lookup.js");
  const result = await quickPlateCheck(plate, chapterId);
  return c.json(result);
});

// --- GET /sightings/:id/feedback — get feedback for a sighting ---
sightingsRouter.get("/:id/feedback", async (c) => {
  const { sightingFeedback } = await import("../../db/schema/vault-a.js");
  const sightingId = c.req.param("id");
  const items = await opsDb
    .select()
    .from(sightingFeedback)
    .where(eq(sightingFeedback.sightingId, sightingId));
  return c.json(items);
});

// --- POST /sightings/:id/feedback — send feedback to reporter ---
sightingsRouter.post("/:id/feedback", async (c) => {
  const { sightingFeedback } = await import("../../db/schema/vault-a.js");
  const sightingId = c.req.param("id");
  const body = await c.req.json();

  // Get the sighting to find the reporter
  const [sighting] = await opsDb.select().from(sightings).where(eq(sightings.id, sightingId)).limit(1);
  if (!sighting) return c.json({ error: "Sighting not found" }, 404);

  const [fb] = await opsDb.insert(sightingFeedback).values({
    sightingId,
    reporterId: sighting.reporterId,
    feedbackType: body.feedbackType || "info",
    message: body.message,
  }).returning();

  return c.json(fb, 201);
});

// --- GET /sightings/:id/photos — get photos for a sighting ---
sightingsRouter.get("/:id/photos", async (c) => {
  const sightingId = c.req.param("id");
  const photos = await opsDb
    .select({
      id: sightingPhotos.id,
      mimeType: sightingPhotos.mimeType,
      photoData: sightingPhotos.photoData,
      exifLat: sightingPhotos.exifLat,
      exifLng: sightingPhotos.exifLng,
      sortOrder: sightingPhotos.sortOrder,
    })
    .from(sightingPhotos)
    .where(eq(sightingPhotos.sightingId, sightingId));
  return c.json(photos);
});
