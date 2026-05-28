/**
 * TRACE API — Watchpoints (Saved Hotspot Locations)
 *
 * Saved locations organized by city group for fast dispatch.
 * Operators click a watchpoint instead of typing an address.
 */
import { Hono } from "hono";
import { opsDb } from "../../db/connection.js";
import { watchpoints, sightings, vehicles } from "../../db/schema/vault-a.js";
import { eq, and, sql, gte, desc } from "drizzle-orm";

export const watchpointsRouter = new Hono();

// GET / — list all watchpoints grouped by city
watchpointsRouter.get("/", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";
  const all = await opsDb.select().from(watchpoints)
    .where(eq(watchpoints.chapterId, chapterId));

  // Group by city
  const grouped: Record<string, typeof all> = {};
  for (const wp of all) {
    const city = wp.cityGroup || "Ungrouped";
    if (!grouped[city]) grouped[city] = [];
    grouped[city].push(wp);
  }

  return c.json({ watchpoints: all, grouped });
});

// POST / — create watchpoint
watchpointsRouter.post("/", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";
  const { name, address, cityGroup, lat, lng, radiusMeters } = await c.req.json();
  if (!name || lat == null || lng == null) return c.json({ error: "Name and coordinates required" }, 400);

  const [wp] = await opsDb.insert(watchpoints).values({
    chapterId, name,
    address: address || null,
    cityGroup: cityGroup || null,
    lat, lng,
    radiusMeters: radiusMeters || 200,
  }).returning();

  return c.json(wp, 201);
});

// PATCH /:id — update watchpoint
watchpointsRouter.patch("/:id", async (c) => {
  const body = await c.req.json();
  const fields: any = {};
  if (body.name) fields.name = body.name;
  if (body.address !== undefined) fields.address = body.address;
  if (body.cityGroup !== undefined) fields.cityGroup = body.cityGroup;
  if (body.lat != null) fields.lat = body.lat;
  if (body.lng != null) fields.lng = body.lng;
  if (body.radiusMeters != null) fields.radiusMeters = body.radiusMeters;

  const [updated] = await opsDb.update(watchpoints)
    .set(fields)
    .where(eq(watchpoints.id, c.req.param("id")))
    .returning();
  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json(updated);
});

// DELETE /:id — delete watchpoint
watchpointsRouter.delete("/:id", async (c) => {
  await opsDb.delete(watchpoints).where(eq(watchpoints.id, c.req.param("id")));
  return c.json({ ok: true });
});

// GET /:id/activity — vehicles sighted near this watchpoint in last 14 days
watchpointsRouter.get("/:id/activity", async (c) => {
  const [wp] = await opsDb.select().from(watchpoints)
    .where(eq(watchpoints.id, c.req.param("id")));
  if (!wp) return c.json({ error: "Not found" }, 404);

  const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString();
  const radius = (wp.radiusMeters || 200) / 111000; // rough degrees

  const nearby = await opsDb.select({
    vehicleId: sightings.vehicleId,
    plate: vehicles.plate,
    make: vehicles.make,
    model: vehicles.model,
    color: vehicles.color,
    observedAt: sightings.observedAt,
  })
    .from(sightings)
    .leftJoin(vehicles, eq(sightings.vehicleId, vehicles.id))
    .where(and(
      eq(sightings.chapterId, wp.chapterId),
      gte(sightings.observedAt, new Date(twoWeeksAgo)),
      sql`ABS(${sightings.lat} - ${wp.lat}) < ${radius}`,
      sql`ABS(${sightings.lng} - ${wp.lng}) < ${radius}`,
    ))
    .orderBy(desc(sightings.observedAt))
    .limit(100);

  // Count per vehicle
  const vehicleCounts: Record<string, { plate: string; make: string; model: string; color: string; count: number; lastSeen: string }> = {};
  for (const s of nearby) {
    if (!s.vehicleId) continue;
    if (!vehicleCounts[s.vehicleId]) {
      vehicleCounts[s.vehicleId] = {
        plate: s.plate || "", make: s.make || "", model: s.model || "", color: s.color || "",
        count: 0, lastSeen: "",
      };
    }
    vehicleCounts[s.vehicleId].count++;
    if (!vehicleCounts[s.vehicleId].lastSeen || (s.observedAt && s.observedAt > new Date(vehicleCounts[s.vehicleId].lastSeen))) {
      vehicleCounts[s.vehicleId].lastSeen = s.observedAt?.toISOString() || "";
    }
  }

  const ranked = Object.entries(vehicleCounts)
    .map(([id, data]) => ({ vehicleId: id, ...data }))
    .sort((a, b) => b.count - a.count);

  return c.json({ watchpoint: wp, totalSightings: nearby.length, vehicles: ranked });
});
