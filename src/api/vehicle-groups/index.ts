/**
 * TRACE API — Vehicle Groups
 *
 * Group vehicles for fast dispatch (convoy teams, priority lists).
 * CRUD on groups + member management.
 */
import { Hono } from "hono";
import { opsDb } from "../../db/connection.js";
import { vehicleGroups, vehicleGroupMembers, vehicles } from "../../db/schema/vault-a.js";
import { eq, and } from "drizzle-orm";

export const vehicleGroupsRouter = new Hono();

// GET / — list all groups with member counts
vehicleGroupsRouter.get("/", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";
  const groups = await opsDb.select().from(vehicleGroups)
    .where(eq(vehicleGroups.chapterId, chapterId));

  const result = await Promise.all(groups.map(async (g) => {
    const members = await opsDb.select({
      vehicleId: vehicleGroupMembers.vehicleId,
      plate: vehicles.plate,
      make: vehicles.make,
      model: vehicles.model,
      color: vehicles.color,
      photoUrl: vehicles.photoUrl,
    })
      .from(vehicleGroupMembers)
      .innerJoin(vehicles, eq(vehicleGroupMembers.vehicleId, vehicles.id))
      .where(eq(vehicleGroupMembers.groupId, g.id));
    return { ...g, members, memberCount: members.length };
  }));

  return c.json(result);
});

// POST / — create group
vehicleGroupsRouter.post("/", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";
  const { name, description, vehicleIds } = await c.req.json();
  if (!name) return c.json({ error: "Name required" }, 400);

  const [group] = await opsDb.insert(vehicleGroups).values({
    chapterId, name, description: description || null,
  }).returning();

  if (vehicleIds?.length) {
    await opsDb.insert(vehicleGroupMembers).values(
      vehicleIds.map((vid: string) => ({ groupId: group.id, vehicleId: vid }))
    ).onConflictDoNothing();
  }

  return c.json(group, 201);
});

// PATCH /:id — update group
vehicleGroupsRouter.patch("/:id", async (c) => {
  const { name, description } = await c.req.json();
  const [updated] = await opsDb.update(vehicleGroups)
    .set({ ...(name ? { name } : {}), ...(description !== undefined ? { description } : {}) })
    .where(eq(vehicleGroups.id, c.req.param("id")))
    .returning();
  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json(updated);
});

// DELETE /:id — delete group (members cascade)
vehicleGroupsRouter.delete("/:id", async (c) => {
  await opsDb.delete(vehicleGroups).where(eq(vehicleGroups.id, c.req.param("id")));
  return c.json({ ok: true });
});

// POST /:id/members — add vehicles
vehicleGroupsRouter.post("/:id/members", async (c) => {
  const { vehicleIds } = await c.req.json();
  if (!vehicleIds?.length) return c.json({ error: "vehicleIds required" }, 400);
  await opsDb.insert(vehicleGroupMembers).values(
    vehicleIds.map((vid: string) => ({ groupId: c.req.param("id"), vehicleId: vid }))
  ).onConflictDoNothing();
  return c.json({ ok: true, added: vehicleIds.length });
});

// DELETE /:id/members/:vehicleId — remove vehicle
vehicleGroupsRouter.delete("/:id/members/:vehicleId", async (c) => {
  await opsDb.delete(vehicleGroupMembers).where(
    and(
      eq(vehicleGroupMembers.groupId, c.req.param("id")),
      eq(vehicleGroupMembers.vehicleId, c.req.param("vehicleId")),
    )
  );
  return c.json({ ok: true });
});
