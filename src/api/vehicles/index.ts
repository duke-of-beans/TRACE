/**
 * TRACE API — Vehicles
 *
 * Vehicle dossier CRUD, type assignment, suspicion level management.
 * Includes lightweight search for reporter-side plate lookup.
 */
import { Hono } from "hono";
import { z } from "zod";
import { opsDb } from "../../db/connection.js";
import {
  vehicles, vehicleTypes, vehicleTypeAssignments,
  vehicleSuspicionHistory, sightings,
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

// --- POST /vehicles/:id/promote — change suspicion level ---
vehiclesRouter.post("/:id/promote", async (c) => {
  const vehicleId = c.req.param("id");
  const { toLevelId, reason } = await c.req.json();
  const changedBy = c.req.header("x-reporter-id") || "";

  // TODO: validate predicates, check authorization
  // TODO: log to vehicleSuspicionHistory
  // TODO: update vehicles.suspicionLevelId

  return c.json({ status: "promoted", vehicleId, toLevelId }, 200);
});
