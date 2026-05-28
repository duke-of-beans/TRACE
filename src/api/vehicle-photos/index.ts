/**
 * TRACE API — Vehicle Photos
 *
 * Multi-photo support for vehicles.
 * Mirrors the actorPhotos pattern (line 278, vault-a.ts).
 */
import { Hono } from "hono";
import { opsDb } from "../../db/connection.js";
import { vehiclePhotos, vehicles } from "../../db/schema/vault-a.js";
import { eq, and, desc } from "drizzle-orm";

export const vehiclePhotosRouter = new Hono();

// GET /:vehicleId — list all photos for a vehicle
vehiclePhotosRouter.get("/:vehicleId", async (c) => {
  const photos = await opsDb.select().from(vehiclePhotos)
    .where(eq(vehiclePhotos.vehicleId, c.req.param("vehicleId")))
    .orderBy(desc(vehiclePhotos.createdAt));
  return c.json(photos);
});

// POST /:vehicleId — add photo
vehiclePhotosRouter.post("/:vehicleId", async (c) => {
  const vehicleId = c.req.param("vehicleId");
  const { photoUrl, description, isPrimary } = await c.req.json();
  if (!photoUrl) return c.json({ error: "photoUrl required" }, 400);

  // If setting as primary, unset existing primaries
  if (isPrimary) {
    await opsDb.update(vehiclePhotos)
      .set({ isPrimary: false })
      .where(eq(vehiclePhotos.vehicleId, vehicleId));
  }

  const [photo] = await opsDb.insert(vehiclePhotos).values({
    vehicleId,
    photoUrl,
    description: description || null,
    isPrimary: isPrimary || false,
  }).returning();

  // If this is the first photo or primary, update vehicle banner
  if (isPrimary) {
    await opsDb.update(vehicles)
      .set({ photoUrl })
      .where(eq(vehicles.id, vehicleId));
  }

  return c.json(photo, 201);
});

// PATCH /:vehicleId/:photoId — update photo metadata
vehiclePhotosRouter.patch("/:vehicleId/:photoId", async (c) => {
  const { description, isPrimary } = await c.req.json();
  const vehicleId = c.req.param("vehicleId");
  const photoId = c.req.param("photoId");

  const fields: any = {};
  if (description !== undefined) fields.description = description;

  if (isPrimary) {
    // Unset other primaries
    await opsDb.update(vehiclePhotos)
      .set({ isPrimary: false })
      .where(eq(vehiclePhotos.vehicleId, vehicleId));
    fields.isPrimary = true;

    // Also update banner photo on vehicle
    const [photo] = await opsDb.select().from(vehiclePhotos)
      .where(eq(vehiclePhotos.id, photoId));
    if (photo) {
      await opsDb.update(vehicles)
        .set({ photoUrl: photo.photoUrl })
        .where(eq(vehicles.id, vehicleId));
    }
  }

  const [updated] = await opsDb.update(vehiclePhotos)
    .set(fields)
    .where(and(eq(vehiclePhotos.id, photoId), eq(vehiclePhotos.vehicleId, vehicleId)))
    .returning();
  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json(updated);
});

// DELETE /:vehicleId/:photoId — delete photo
vehiclePhotosRouter.delete("/:vehicleId/:photoId", async (c) => {
  const vehicleId = c.req.param("vehicleId");
  const photoId = c.req.param("photoId");

  const [deleted] = await opsDb.delete(vehiclePhotos)
    .where(and(eq(vehiclePhotos.id, photoId), eq(vehiclePhotos.vehicleId, vehicleId)))
    .returning();

  // If deleted photo was primary, promote next photo or clear banner
  if (deleted?.isPrimary) {
    const [next] = await opsDb.select().from(vehiclePhotos)
      .where(eq(vehiclePhotos.vehicleId, vehicleId))
      .orderBy(desc(vehiclePhotos.createdAt))
      .limit(1);
    if (next) {
      await opsDb.update(vehiclePhotos).set({ isPrimary: true }).where(eq(vehiclePhotos.id, next.id));
      await opsDb.update(vehicles).set({ photoUrl: next.photoUrl }).where(eq(vehicles.id, vehicleId));
    } else {
      await opsDb.update(vehicles).set({ photoUrl: null }).where(eq(vehicles.id, vehicleId));
    }
  }

  return c.json({ ok: true });
});
