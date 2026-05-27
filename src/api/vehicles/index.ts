/**
 * TRACE API — Vehicles
 *
 * Vehicle record CRUD, type assignment, concern level management.
 * Includes lightweight search for reporter-side plate lookup.
 */
import { Hono } from "hono";
import { z } from "zod";
import { opsDb } from "../../db/connection.js";
import {
  vehicles, vehicleTypes, vehicleTypeAssignments,
  vehicleConcernHistory, concernLevels, sightings,
} from "../../db/schema/vault-a.js";
import { eq, desc, ilike, or, and } from "drizzle-orm";

export const vehiclesRouter = new Hono();

// --- GET /vehicles — list active vehicles ---
vehiclesRouter.get("/", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";
  const results = await opsDb
    .select()
    .from(vehicles)
    .where(and(
      eq(vehicles.chapterId, chapterId),
      eq(vehicles.status, "active"),
    ))
    .orderBy(desc(vehicles.lastSeenAt))
    .limit(100);

  return c.json(results);
});

// --- GET /vehicles/search — reporter-side plate lookup ---
vehiclesRouter.get("/search", async (c) => {
  const q = c.req.query("q") || "";
  if (q.length < 2) return c.json({ error: "Query too short" }, 400);

  const chapterId = c.req.header("x-chapter-id") || "";
  const results = await opsDb
    .select()
    .from(vehicles)
    .where(and(
      eq(vehicles.chapterId, chapterId),
      or(
        ilike(vehicles.plate, `%${q}%`),
        ilike(vehicles.description, `%${q}%`),
      ),
    ))
    .limit(20);

  return c.json(results);
});

// --- POST /vehicles — create vehicle dossier ---
vehiclesRouter.post("/", async (c) => {
  const body = await c.req.json();
  const chapterId = c.req.header("x-chapter-id") || "";

  const [vehicle] = await opsDb
    .insert(vehicles)
    .values({ chapterId, ...body })
    .returning();

  return c.json(vehicle, 201);
});

// --- GET /vehicles/:id — full dossier ---
vehiclesRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [vehicle] = await opsDb
    .select()
    .from(vehicles)
    .where(eq(vehicles.id, id))
    .limit(1);

  if (!vehicle) return c.json({ error: "Not found" }, 404);

  // TODO: join vehicle types, suspicion history, recent sightings, linked actors
  return c.json(vehicle);
});

// --- PUT /vehicles/:id — update vehicle ---
vehiclesRouter.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const { plate, make, model, year, color, description, notes, status } = body;
  const [updated] = await opsDb
    .update(vehicles)
    .set({ plate, make, model, year, color, description, notes, status, updatedAt: new Date() })
    .where(eq(vehicles.id, id))
    .returning();
  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json(updated);
});

// --- DELETE /vehicles/:id — retire vehicle ---
vehiclesRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const [retired] = await opsDb
    .update(vehicles)
    .set({ status: "retired", retiredAt: new Date(), updatedAt: new Date() })
    .where(eq(vehicles.id, id))
    .returning();
  if (!retired) return c.json({ error: "Not found" }, 404);
  return c.json(retired);
});

// --- POST /vehicles/:id/promote — change concern level ---
vehiclesRouter.post("/:id/promote", async (c) => {
  const vehicleId = c.req.param("id");
  const { toLevelId, reason } = await c.req.json();
  const changedBy = c.req.header("x-reporter-id") || "";

  if (!toLevelId || !reason) {
    return c.json({ error: "toLevelId and reason required" }, 400);
  }

  // Get current vehicle to record the fromLevelId
  const [vehicle] = await opsDb.select().from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1);
  if (!vehicle) return c.json({ error: "Vehicle not found" }, 404);

  // Verify target level exists
  const [targetLevel] = await opsDb.select().from(concernLevels).where(eq(concernLevels.id, toLevelId)).limit(1);
  if (!targetLevel) return c.json({ error: "Target level not found" }, 404);

  // Update the vehicle's concern level
  await opsDb.update(vehicles).set({ suspicionLevelId: toLevelId }).where(eq(vehicles.id, vehicleId));

  // Log to concern history
  await opsDb.insert(vehicleConcernHistory).values({
    vehicleId,
    fromLevelId: vehicle.suspicionLevelId || null,
    toLevelId,
    reason,
    changedBy: changedBy || "operator",
    changedByRole: "operator",
    predicatesMet: [],
  });

  return c.json({ status: "promoted", vehicleId, toLevelId, from: vehicle.suspicionLevelId }, 200);
});

// --- GET /vehicles/search-plates — auto-suggest as reporter types ---
vehiclesRouter.get("/search-plates", async (c) => {
  const q = c.req.query("q")?.toUpperCase().trim();
  if (!q || q.length < 2) return c.json([]);

  const chapterId = c.req.header("x-chapter-id") || "";
  const matches = await opsDb
    .select({
      id: vehicles.id,
      plate: vehicles.plate,
      make: vehicles.make,
      model: vehicles.model,
      color: vehicles.color,
      suspicionLevelId: vehicles.suspicionLevelId,
    })
    .from(vehicles)
    .where(and(
      eq(vehicles.chapterId, chapterId),
      ilike(vehicles.plate, `%${q}%`),
    ))
    .limit(5);

  return c.json(matches);
});
