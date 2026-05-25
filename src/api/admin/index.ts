/**
 * TRACE API — Admin
 *
 * Full CRUD for chapter configuration with dependency checking.
 * Vehicle types, suspicion levels + predicates, reporters, notifications.
 */
import { Hono } from "hono";
import { opsDb, identDb } from "../../db/connection.js";
import {
  chapters, vehicleTypes, suspicionLevels, suspicionPredicates,
  actorRiskLevels, notificationChannels, notificationRules,
  reporters, vehicles, vehicleTypeAssignments, vehicleSuspicionHistory,
} from "../../db/schema/vault-a.js";
import { reporterIdentities } from "../../db/schema/vault-b.js";
import { eq, and, count } from "drizzle-orm";
import { generateCasePackage } from "../../services/case-package.js";
import { encryptFields } from "../../services/encryption.js";

export const adminRouter = new Hono();

// --- GET /admin/chapter ---
adminRouter.get("/chapter", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";
  const [chapter] = await opsDb.select().from(chapters).where(eq(chapters.id, chapterId)).limit(1);
  return c.json(chapter || { error: "Not found" });
});

// ============================================================
// VEHICLE TYPES — full CRUD with dependency check
// ============================================================
adminRouter.get("/vehicle-types", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";
  const types = await opsDb.select().from(vehicleTypes).where(eq(vehicleTypes.chapterId, chapterId));
  return c.json(types);
});

adminRouter.post("/vehicle-types", async (c) => {
  const body = await c.req.json();
  const chapterId = c.req.header("x-chapter-id") || "";
  const [vt] = await opsDb.insert(vehicleTypes).values({ chapterId, ...body }).returning();
  return c.json(vt, 201);
});

adminRouter.put("/vehicle-types/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const [updated] = await opsDb
    .update(vehicleTypes)
    .set({ label: body.label, description: body.description, color: body.color, icon: body.icon, sortOrder: body.sortOrder })
    .where(eq(vehicleTypes.id, id))
    .returning();
  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json(updated);
});

adminRouter.delete("/vehicle-types/:id", async (c) => {
  const id = c.req.param("id");
  // dependency check: any vehicles assigned this type?
  const [dep] = await opsDb
    .select({ total: count() })
    .from(vehicleTypeAssignments)
    .where(eq(vehicleTypeAssignments.vehicleTypeId, id));

  if (dep.total > 0) {
    return c.json({
      error: "Cannot delete",
      reason: `${dep.total} vehicle(s) are assigned this type. Remove assignments first.`,
      dependencyCount: dep.total,
    }, 409);
  }

  await opsDb.delete(vehicleTypes).where(eq(vehicleTypes.id, id));
  return c.json({ deleted: true });
});

// ============================================================
// SUSPICION LEVELS — full CRUD with dependency check + predicates
// ============================================================
adminRouter.get("/suspicion-levels", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";
  const levels = await opsDb.select().from(suspicionLevels).where(eq(suspicionLevels.chapterId, chapterId));
  return c.json(levels);
});

adminRouter.post("/suspicion-levels", async (c) => {
  const body = await c.req.json();
  const chapterId = c.req.header("x-chapter-id") || "";
  const [level] = await opsDb.insert(suspicionLevels).values({ chapterId, ...body }).returning();
  return c.json(level, 201);
});

adminRouter.put("/suspicion-levels/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const [updated] = await opsDb
    .update(suspicionLevels)
    .set({ label: body.label, rank: body.rank, description: body.description, color: body.color })
    .where(eq(suspicionLevels.id, id))
    .returning();
  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json(updated);
});

adminRouter.delete("/suspicion-levels/:id", async (c) => {
  const id = c.req.param("id");
  // dependency check: any vehicles at this level?
  const [vDep] = await opsDb
    .select({ total: count() })
    .from(vehicles)
    .where(eq(vehicles.suspicionLevelId, id));

  // dependency check: any predicates targeting this level?
  const [pDep] = await opsDb
    .select({ total: count() })
    .from(suspicionPredicates)
    .where(eq(suspicionPredicates.targetLevelId, id));

  if (vDep.total > 0 || pDep.total > 0) {
    return c.json({
      error: "Cannot delete",
      reason: `${vDep.total} vehicle(s) at this level, ${pDep.total} predicate(s) targeting it.`,
      vehicleCount: vDep.total,
      predicateCount: pDep.total,
    }, 409);
  }

  await opsDb.delete(suspicionLevels).where(eq(suspicionLevels.id, id));
  return c.json({ deleted: true });
});

// --- Suspicion Predicates (promotion rules per level) ---
adminRouter.get("/suspicion-levels/:levelId/predicates", async (c) => {
  const levelId = c.req.param("levelId");
  const preds = await opsDb
    .select()
    .from(suspicionPredicates)
    .where(eq(suspicionPredicates.targetLevelId, levelId));
  return c.json(preds);
});

adminRouter.post("/suspicion-levels/:levelId/predicates", async (c) => {
  const levelId = c.req.param("levelId");
  const body = await c.req.json();
  const chapterId = c.req.header("x-chapter-id") || "";
  const [pred] = await opsDb
    .insert(suspicionPredicates)
    .values({ chapterId, targetLevelId: levelId, ...body })
    .returning();
  return c.json(pred, 201);
});

adminRouter.put("/suspicion-predicates/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const [updated] = await opsDb
    .update(suspicionPredicates)
    .set({ label: body.label, predicateType: body.predicateType, config: body.config, conjunction: body.conjunction })
    .where(eq(suspicionPredicates.id, id))
    .returning();
  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json(updated);
});

adminRouter.delete("/suspicion-predicates/:id", async (c) => {
  const id = c.req.param("id");
  await opsDb.delete(suspicionPredicates).where(eq(suspicionPredicates.id, id));
  return c.json({ deleted: true });
});

// ============================================================
// REPORTERS
// ============================================================
adminRouter.post("/reporters/invite", async (c) => {
  const { callsign, email, realName, phone } = await c.req.json();
  const chapterId = c.req.header("x-chapter-id") || "";

  const [reporter] = await opsDb
    .insert(reporters)
    .values({ chapterId, callsign })
    .returning();

  const encryptedIdentity = encryptFields(
    { realName, email, phone },
    ["realName", "phone"]
  );

  await identDb.insert(reporterIdentities).values({
    reporterId: reporter.id,
    realName: encryptedIdentity.realName,
    email,
    phone: encryptedIdentity.phone,
    role: "reporter",
  });

  return c.json({ reporterId: reporter.id, callsign }, 201);
});

// ============================================================
// NOTIFICATIONS
// ============================================================
adminRouter.get("/notifications/channels", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";
  const channels = await opsDb
    .select()
    .from(notificationChannels)
    .where(eq(notificationChannels.chapterId, chapterId));
  return c.json(channels);
});

adminRouter.post("/notifications/channels", async (c) => {
  const body = await c.req.json();
  const chapterId = c.req.header("x-chapter-id") || "";
  const [ch] = await opsDb
    .insert(notificationChannels)
    .values({ chapterId, ...body })
    .returning();
  return c.json(ch, 201);
});

// ============================================================
// CASE PACKAGES
// ============================================================
adminRouter.post("/case-packages", async (c) => {
  const { title, description, vehicleId, actorId } = await c.req.json();
  const chapterId = c.req.header("x-chapter-id") || "";
  const generatedBy = c.req.header("x-reporter-id") || "";

  const result = await generateCasePackage({
    chapterId, vehicleId, actorId, title, description, generatedBy,
  });

  return c.json(result, 201);
});
