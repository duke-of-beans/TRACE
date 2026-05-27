/**
 * TRACE API — Actors (criminal profiles)
 *
 * Persistent across vehicle retirements.
 * A driver outlives their vehicles.
 */
import { Hono } from "hono";
import { opsDb } from "../../db/connection.js";
import { actors, actorVehicles, actorConcernLevels } from "../../db/schema/vault-a.js";
import { eq, desc, and } from "drizzle-orm";

export const actorsRouter = new Hono();

// --- GET /actors ---
actorsRouter.get("/", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";
  const results = await opsDb
    .select()
    .from(actors)
    .where(and(eq(actors.chapterId, chapterId), eq(actors.status, "active")))
    .orderBy(desc(actors.updatedAt))
    .limit(100);
  return c.json(results);
});

// --- POST /actors ---
actorsRouter.post("/", async (c) => {
  const body = await c.req.json();
  const chapterId = c.req.header("x-chapter-id") || "";
  const [actor] = await opsDb
    .insert(actors)
    .values({ chapterId, ...body })
    .returning();
  return c.json(actor, 201);
});

// --- GET /actors/:id ---
actorsRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [actor] = await opsDb.select().from(actors).where(eq(actors.id, id)).limit(1);
  if (!actor) return c.json({ error: "Not found" }, 404);
  // TODO: join vehicles, photos, risk level detail
  return c.json(actor);
});

// --- PUT /actors/:id ---
actorsRouter.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const { alias, physicalDescription, notes, status } = body;
  const [updated] = await opsDb
    .update(actors)
    .set({ alias, physicalDescription, notes, status, updatedAt: new Date() })
    .where(eq(actors.id, id))
    .returning();
  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json(updated);
});

// --- DELETE /actors/:id — soft delete ---
actorsRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const [retired] = await opsDb
    .update(actors)
    .set({ status: "inactive", updatedAt: new Date() })
    .where(eq(actors.id, id))
    .returning();
  if (!retired) return c.json({ error: "Not found" }, 404);
  return c.json(retired);
});

// --- POST /actors/:id/vehicles — link actor to vehicle ---
actorsRouter.post("/:id/vehicles", async (c) => {
  const actorId = c.req.param("id");
  const { vehicleId, notes } = await c.req.json();
  const [link] = await opsDb
    .insert(actorVehicles)
    .values({ actorId, vehicleId, notes })
    .returning();
  return c.json(link, 201);
});
