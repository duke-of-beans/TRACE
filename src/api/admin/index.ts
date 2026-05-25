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
  actorSuspicionLevels, actorSuspicionPredicates, actorIdentifierTypes,
  actorIdentifiers, notificationChannels, notificationRules,
  reporters, vehicles, vehicleTypeAssignments, vehicleSuspicionHistory,
  actors,
} from "../../db/schema/vault-a.js";
import { reporterIdentities, sessions } from "../../db/schema/vault-b.js";
import { eq, and, count } from "drizzle-orm";
import { generateCasePackage } from "../../services/case-package.js";
import { encryptFields } from "../../services/encryption.js";
import webpush from "web-push";

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
// ACTOR SUSPICION LEVELS — full CRUD with dependency check
// ============================================================
adminRouter.get("/actor-suspicion-levels", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";
  const levels = await opsDb.select().from(actorSuspicionLevels).where(eq(actorSuspicionLevels.chapterId, chapterId));
  return c.json(levels);
});

adminRouter.post("/actor-suspicion-levels", async (c) => {
  const body = await c.req.json();
  const chapterId = c.req.header("x-chapter-id") || "";
  const [level] = await opsDb.insert(actorSuspicionLevels).values({ chapterId, ...body }).returning();
  return c.json(level, 201);
});

adminRouter.put("/actor-suspicion-levels/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const [updated] = await opsDb
    .update(actorSuspicionLevels)
    .set({ label: body.label, rank: body.rank, description: body.description, color: body.color })
    .where(eq(actorSuspicionLevels.id, id))
    .returning();
  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json(updated);
});

adminRouter.delete("/actor-suspicion-levels/:id", async (c) => {
  const id = c.req.param("id");
  const [aDep] = await opsDb.select({ total: count() }).from(actors).where(eq(actors.suspicionLevelId, id));
  const [pDep] = await opsDb.select({ total: count() }).from(actorSuspicionPredicates).where(eq(actorSuspicionPredicates.targetLevelId, id));
  if (aDep.total > 0 || pDep.total > 0) {
    return c.json({ error: "Cannot delete", reason: `${aDep.total} actor(s) at this level, ${pDep.total} predicate(s) targeting it.` }, 409);
  }
  await opsDb.delete(actorSuspicionLevels).where(eq(actorSuspicionLevels.id, id));
  return c.json({ deleted: true });
});

// --- Actor Suspicion Predicates ---
adminRouter.get("/actor-suspicion-levels/:levelId/predicates", async (c) => {
  const levelId = c.req.param("levelId");
  const preds = await opsDb.select().from(actorSuspicionPredicates).where(eq(actorSuspicionPredicates.targetLevelId, levelId));
  return c.json(preds);
});

adminRouter.post("/actor-suspicion-levels/:levelId/predicates", async (c) => {
  const levelId = c.req.param("levelId");
  const body = await c.req.json();
  const chapterId = c.req.header("x-chapter-id") || "";
  const [pred] = await opsDb.insert(actorSuspicionPredicates).values({ chapterId, targetLevelId: levelId, ...body }).returning();
  return c.json(pred, 201);
});

adminRouter.delete("/actor-suspicion-predicates/:id", async (c) => {
  const id = c.req.param("id");
  await opsDb.delete(actorSuspicionPredicates).where(eq(actorSuspicionPredicates.id, id));
  return c.json({ deleted: true });
});

// ============================================================
// ACTOR IDENTIFIER TYPES — chapter-defined taxonomy CRUD
// ============================================================
adminRouter.get("/actor-identifier-types", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";
  const types = await opsDb.select().from(actorIdentifierTypes).where(eq(actorIdentifierTypes.chapterId, chapterId));
  return c.json(types);
});

adminRouter.post("/actor-identifier-types", async (c) => {
  const body = await c.req.json();
  const chapterId = c.req.header("x-chapter-id") || "";
  const [t] = await opsDb.insert(actorIdentifierTypes).values({ chapterId, ...body }).returning();
  return c.json(t, 201);
});

adminRouter.put("/actor-identifier-types/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const [updated] = await opsDb
    .update(actorIdentifierTypes)
    .set({ label: body.label, description: body.description, icon: body.icon, color: body.color, fieldType: body.fieldType, options: body.options, sortOrder: body.sortOrder })
    .where(eq(actorIdentifierTypes.id, id))
    .returning();
  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json(updated);
});

adminRouter.delete("/actor-identifier-types/:id", async (c) => {
  const id = c.req.param("id");
  const [dep] = await opsDb.select({ total: count() }).from(actorIdentifiers).where(eq(actorIdentifiers.identifierTypeId, id));
  if (dep.total > 0) {
    return c.json({ error: "Cannot delete", reason: `${dep.total} identifier(s) use this type. Remove them first.` }, 409);
  }
  await opsDb.delete(actorIdentifierTypes).where(eq(actorIdentifierTypes.id, id));
  return c.json({ deleted: true });
});

// ============================================================
// ACTOR IDENTIFIERS — per-actor values CRUD
// ============================================================
adminRouter.get("/actors/:actorId/identifiers", async (c) => {
  const actorId = c.req.param("actorId");
  const ids = await opsDb.select().from(actorIdentifiers).where(eq(actorIdentifiers.actorId, actorId));
  return c.json(ids);
});

adminRouter.post("/actors/:actorId/identifiers", async (c) => {
  const actorId = c.req.param("actorId");
  const body = await c.req.json();
  const [ident] = await opsDb.insert(actorIdentifiers).values({ actorId, ...body }).returning();
  return c.json(ident, 201);
});

adminRouter.put("/actor-identifiers/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const [updated] = await opsDb
    .update(actorIdentifiers)
    .set({ value: body.value, confidence: body.confidence, notes: body.notes, lastObserved: body.lastObserved ? new Date(body.lastObserved) : undefined, updatedAt: new Date() })
    .where(eq(actorIdentifiers.id, id))
    .returning();
  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json(updated);
});

adminRouter.delete("/actor-identifiers/:id", async (c) => {
  const id = c.req.param("id");
  await opsDb.delete(actorIdentifiers).where(eq(actorIdentifiers.id, id));
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

// --- POST /admin/reporters/:id/kill — remote kill a reporter's device ---
// Suspends the reporter, revokes all sessions, sends push kill signal.
// On next check-in, the reporter's app will self-destruct.
adminRouter.post("/reporters/:id/kill", async (c) => {
  const reporterId = c.req.param("id");

  // 1. Suspend the reporter (triggers kill on next heartbeat)
  await opsDb
    .update(reporters)
    .set({ status: "suspended", updatedAt: new Date() })
    .where(eq(reporters.id, reporterId));

  // 2. Revoke all sessions in Vault B
  const [identity] = await identDb
    .select()
    .from(reporterIdentities)
    .where(eq(reporterIdentities.reporterId, reporterId))
    .limit(1);

  if (identity) {
    await identDb
      .delete(sessions)
      .where(eq(sessions.identityId, identity.id));
  }

  // 3. Send push kill signal (if push subscription exists)
  const [reporter] = await opsDb
    .select()
    .from(reporters)
    .where(eq(reporters.id, reporterId))
    .limit(1);

  if (reporter?.pushSubscription) {
    try {
      await webpush.sendNotification(
        reporter.pushSubscription as webpush.PushSubscription,
        JSON.stringify({ type: "kill", command: "self-destruct" })
      );
    } catch {
      // push may fail if subscription is stale — kill will still
      // fire on next heartbeat via the suspended status check
    }
  }

  return c.json({ killed: true, reporterId });
});

// --- POST /admin/reporters/:id/suspend — soft suspend (revoke access, no push kill) ---
adminRouter.post("/reporters/:id/suspend", async (c) => {
  const reporterId = c.req.param("id");

  await opsDb
    .update(reporters)
    .set({ status: "suspended", updatedAt: new Date() })
    .where(eq(reporters.id, reporterId));

  // revoke sessions
  const [identity] = await identDb
    .select()
    .from(reporterIdentities)
    .where(eq(reporterIdentities.reporterId, reporterId))
    .limit(1);

  if (identity) {
    await identDb.delete(sessions).where(eq(sessions.identityId, identity.id));
  }

  return c.json({ suspended: true, reporterId });
});

// --- POST /admin/reporters/:id/reactivate ---
adminRouter.post("/reporters/:id/reactivate", async (c) => {
  const reporterId = c.req.param("id");
  await opsDb
    .update(reporters)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(reporters.id, reporterId));
  return c.json({ reactivated: true, reporterId });
});

// --- POST /admin/nuke — EMERGENCY: kill ALL reporters in chapter ---
// Suspends every reporter, revokes all sessions, sends push kill to all.
adminRouter.post("/nuke", async (c) => {
  const chapterId = c.req.header("x-chapter-id") || "";

  // suspend all reporters in chapter
  const allReporters = await opsDb
    .select()
    .from(reporters)
    .where(eq(reporters.chapterId, chapterId));

  let killed = 0;
  for (const reporter of allReporters) {
    // suspend
    await opsDb
      .update(reporters)
      .set({ status: "suspended", updatedAt: new Date() })
      .where(eq(reporters.id, reporter.id));

    // revoke sessions
    const [identity] = await identDb
      .select()
      .from(reporterIdentities)
      .where(eq(reporterIdentities.reporterId, reporter.id))
      .limit(1);

    if (identity) {
      await identDb.delete(sessions).where(eq(sessions.identityId, identity.id));
    }

    // push kill
    if (reporter.pushSubscription) {
      try {
        await webpush.sendNotification(
          reporter.pushSubscription as webpush.PushSubscription,
          JSON.stringify({ type: "kill", command: "self-destruct" })
        );
      } catch {}
    }
    killed++;
  }

  return c.json({ nuked: true, chapterId, reportersKilled: killed });
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
