/**
 * TRACE — Tag Definitions API
 *
 * Chapter-scoped tag management. Tags are configurable labels
 * applied to sightings, vehicles, or harassment reports.
 * Default tags are seeded on chapter setup.
 */
import { Hono } from "hono";
import { opsDb } from "../../db/connection.js";
import { tagDefinitions } from "../../db/schema/vault-a.js";
import { eq, and, asc } from "drizzle-orm";

export const tagRouter = new Hono();

// GET / — list tag definitions for the chapter
tagRouter.get("/", async (c) => {
  const chapterId = c.req.header("x-chapter-id");
  if (!chapterId) return c.json({ error: "Missing chapter" }, 400);

  const context = c.req.query("context");

  const conditions = [eq(tagDefinitions.chapterId, chapterId)];
  if (context) {
    conditions.push(eq(tagDefinitions.context, context));
  }

  const tags = await opsDb
    .select()
    .from(tagDefinitions)
    .where(and(...conditions))
    .orderBy(asc(tagDefinitions.context), asc(tagDefinitions.sortOrder));

  return c.json(tags);
});

// POST / — create a custom tag
tagRouter.post("/", async (c) => {
  const chapterId = c.req.header("x-chapter-id");
  if (!chapterId) return c.json({ error: "Missing chapter" }, 400);

  const body = await c.req.json();
  const { context, label, color, sortOrder } = body;

  if (!context || !label) {
    return c.json({ error: "context and label required" }, 400);
  }
  if (!["sighting", "vehicle", "harassment"].includes(context)) {
    return c.json({ error: "context must be sighting, vehicle, or harassment" }, 400);
  }

  try {
    const [tag] = await opsDb
      .insert(tagDefinitions)
      .values({
        chapterId,
        context,
        label: label.trim(),
        color: color || "#818CF8",
        sortOrder: sortOrder ?? 0,
      })
      .returning();
    return c.json(tag, 201);
  } catch (err: any) {
    if (err.code === "23505") {
      return c.json({ error: "Tag already exists for this context" }, 409);
    }
    throw err;
  }
});

// DELETE /:id — delete a custom tag
tagRouter.delete("/:id", async (c) => {
  const chapterId = c.req.header("x-chapter-id");
  if (!chapterId) return c.json({ error: "Missing chapter" }, 400);

  const id = c.req.param("id");

  const deleted = await opsDb
    .delete(tagDefinitions)
    .where(and(eq(tagDefinitions.id, id), eq(tagDefinitions.chapterId, chapterId)))
    .returning();

  if (deleted.length === 0) {
    return c.json({ error: "Tag not found" }, 404);
  }

  return c.json({ deleted: true });
});
