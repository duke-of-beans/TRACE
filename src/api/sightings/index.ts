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

  const [sighting] = await opsDb
    .insert(sightings)
    .values({
      chapterId,
      reporterId,
      ...parsed.data,
      observedAt,
      jitterApplied: shouldApplyJitter(role),
    })
    .returning();

  // real-time: push to operator triage queue
  emitNewSighting(chapterId, sighting);

  // push notifications
  dispatch({
    event: "new_sighting",
    chapterId,
    data: { vehicleId: parsed.data.vehicleId },
  }).catch(() => {}); // fire and forget

  return c.json(sighting, 201);
});

// --- GET /sightings — list sightings (operator triage queue) ---
sightingsRouter.get("/", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";
  const untriaged = c.req.query("untriaged") === "true";

  let query = opsDb.select().from(sightings);

  // TODO: proper filtering with chapter scope + pagination
  const results = await opsDb
    .select()
    .from(sightings)
    .where(
      untriaged
        ? and(eq(sightings.chapterId, chapterId), eq(sightings.triaged, false))
        : eq(sightings.chapterId, chapterId)
    )
    .orderBy(desc(sightings.submittedAt))
    .limit(50);

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
